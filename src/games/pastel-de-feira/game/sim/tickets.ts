import { CHARM_CHORINHO, CHARM_GIFT, DIRT_FAIL_LIMIT, DIRT_FAIL_WEIGHT, DIRT_PER_ORDER, EAT_SECONDS, FAIL_WEIGHT, HYGIENE_DIRT_FACTOR, NO_BAG_PENALTY } from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import type { ItemRef, Profile } from '../types';
import { failOrder, itemCost, minQuality, removeCustomer, salePrice, tablePremium } from './customers';
import { addDirt } from './dirt';
import { currentQuality, drinkValue, pastryValue, roundCents } from './quality';
import { addCharm, recordFailure, recordSuccess } from './reputation';
import {
  emit, newId, now, type Cup, type Customer, type DayState, type OrderLine, type Ready, type Ticket, type TicketKind, type Track, type Worker,
} from './state';

/** Trilho de cada tipo de comanda: balcão e mesa no balcão, app e encomenda na Expedição (RN-181). */
export const trackOf = (kind: TicketKind): Track => (kind === 'app' || kind === 'encomenda' ? 'expedicao' : 'balcao');

/** Prefixo do número visível (RN-180). */
export const TICKET_PREFIX: Readonly<Record<TicketKind, string>> = { balcao: '#', mesa: 'M', app: 'APP ', encomenda: 'E' };

/** Rótulo da comanda como aparece no trilho e na placa do dono: "#3", "M2", "APP 7", "E1". */
export const ticketLabel = (t: Ticket): string => `${TICKET_PREFIX[t.kind]}${t.num}`;

/** O item do slot é um pastel (e não um copo de caldo). */
export const isPastry = (x: Ready | Cup): x is Ready => 'quality' in x;

/** Cria a comanda no momento em que o pedido entra (RN-180). */
export function createTicket(s: DayState, kind: TicketKind, owner: number | null, slots: OrderLine[], enteredAt = now(s)): Ticket {
  const t: Ticket = { id: newId(s), num: s.nextTicketNum++, kind, track: trackOf(kind), owner, enteredAt, slots };
  s.tickets.push(t);
  emit(s, 'ticket_criada', t.id);
  return t;
}

/** Comanda aberta de um cliente ou grupo, se houver. */
export const ticketOf = (s: DayState, customerId: number): Ticket | undefined =>
  s.tickets.find((t) => t.owner === customerId && (t.kind === 'balcao' || t.kind === 'mesa'));

/** Comandas abertas de um trilho, da mais antiga para a mais nova (RN-188). */
export const openTickets = (s: DayState, track: Track): Ticket[] =>
  s.tickets.filter((t) => t.track === track).sort((a, b) => a.enteredAt - b.enteredAt || a.num - b.num);

/** Tira a comanda do trilho (entregue ou cancelada). */
export function dropTicket(s: DayState, t: Ticket): void {
  const i = s.tickets.indexOf(t);
  if (i >= 0) s.tickets.splice(i, 1);
}

/** Cancela a comanda: sai do trilho e os itens já postos nela se perdem (RN-06, RN-94, RN-104). */
export function cancelTicket(s: DayState, t: Ticket): void {
  dropTicket(s, t);
  emit(s, 'ticket_cancelada', t.id);
}

/** Cria a comanda de um cliente ou grupo anotado: os itens são o próprio pedido dele. */
export function ticketForCustomer(s: DayState, c: Customer): Ticket {
  return createTicket(s, c.group ? 'mesa' : 'balcao', c.id, c.lines);
}

/** Perfil que vale para um item da comanda (grupos têm perfis por integrante). */
const profileOf = (s: DayState, t: Ticket, slot: OrderLine): Profile | null => {
  if (slot.profile) return slot.profile;
  const c = t.owner === null ? undefined : s.customers.find((x) => x.id === t.owner);
  return c?.profile ?? null;
};

/**
 * Como um item pronto casa com um item livre da comanda (RN-18, RN-182): `exato`; `sabor` (mesma receita,
 * outra versão, aceito por quem não é Exigente); `versao` (Exigente com outra versão: entra, mas conta falha);
 * ou `nao` (outro sabor ou outro tipo: recusado).
 */
export function slotMatch(profile: Profile | null, slot: OrderLine, item: ItemId): 'exato' | 'sabor' | 'versao' | 'nao' {
  if (slot.filled !== null) return 'nao';
  const want = ITEMS[slot.item];
  const got = ITEMS[item];
  if ((want.kind === 'bebida') !== (got.kind === 'bebida')) return 'nao';
  if (slot.item === item) return 'exato';
  if (want.base !== got.base) return 'nao';
  return profile === 'exigente' ? 'versao' : 'sabor';
}

/** Índice do item livre que recebe o pronto: o exato primeiro, depois o de mesmo sabor; -1 se recusa. */
export function slotFor(s: DayState, t: Ticket, item: ItemId): number {
  let best = -1;
  let rank = 0;
  const order = { exato: 3, sabor: 2, versao: 1, nao: 0 } as const;
  t.slots.forEach((slot, i) => {
    const r = order[slotMatch(profileOf(s, t, slot), slot, item)];
    if (r > rank) {
      rank = r;
      best = i;
    }
  });
  return best;
}

/** A comanda aceita o item (destaque do destino, RN-184)? */
export const ticketAccepts = (s: DayState, t: Ticket, item: ItemId): boolean => slotFor(s, t, item) >= 0;

/** Item pronto livre (sem comanda) de uma referência. */
export function freeItem(s: DayState, ref: ItemRef): Ready | Cup | undefined {
  return ref.kind === 'pastel' ? s.ready.find((r) => r.id === ref.id) : s.cups.find((x) => x.id === ref.id);
}

/**
 * Põe um pronto na comanda (RN-182). Sabor sem item livre é recusado sem custo: devolve false e o item fica
 * onde estava. Para o Exigente, a versão errada entra e marca o pedido (RN-63). A comanda completa é
 * entregue na hora (RN-186).
 */
export function fill(s: DayState, t: Ticket, ref: ItemRef, by?: Worker): boolean {
  const x = freeItem(s, ref);
  if (!x) return false;
  const k = slotFor(s, t, x.item);
  if (k < 0) {
    emit(s, 'ticket_recusou', t.id);
    return false;
  }
  const slot = t.slots[k];
  if (slotMatch(profileOf(s, t, slot), slot, x.item) === 'versao') markWrongVersion(s, t);
  if (isPastry(x)) {
    const bag = t.track === 'expedicao';
    if (x.warmed || bag) {
      // sai da estufa (RN-27) ou entra na sacola/caixa (RN-189): a nota de agora vale como ponto de partida
      x.quality = currentQuality(x, now(s));
      x.readyAt = now(s);
      x.warmed = false;
      x.bagged = bag;
    }
    s.ready.splice(s.ready.indexOf(x), 1);
  } else {
    s.cups.splice(s.cups.indexOf(x), 1);
  }
  slot.filled = x;
  emit(s, 'ticket_preenchida', t.id);
  if (t.slots.every((l) => l.filled !== null)) completeTicket(s, t, by);
  return true;
}

/** Versão errada para o Exigente: conta como item errado uma vez por pedido (RN-63). */
function markWrongVersion(s: DayState, t: Ticket): void {
  const c = s.customers.find((x) => x.id === t.owner);
  if (!c || c.wrong) return;
  c.wrong = true;
  s.stats.wrong++;
  emit(s, 'item_errado', c.id);
}

/** Entrega da comanda completa (RN-186). */
function completeTicket(s: DayState, t: Ticket, by?: Worker): void {
  if (t.kind === 'balcao' || t.kind === 'mesa') completeCustomer(s, t, by);
}

/** Cliente de balcão paga e sai; grupo de mesa come e paga depois (RN-20, RN-82, RN-87). */
function completeCustomer(s: DayState, t: Ticket, by?: Worker): void {
  const c = s.customers.find((x) => x.id === t.owner);
  if (!c) return;
  let owed = 0;
  for (const slot of t.slots) {
    const x = slot.filled!;
    const itemId = x.item;
    let value: number;
    if (isPastry(x)) {
      let nota = currentQuality(x, now(s));
      if (s.consumables.saquinho > 0) s.consumables.saquinho--;
      else nota = Math.max(0, nota - NO_BAG_PENALTY); // sem saquinho (RN-28)
      if (nota < minQuality(s, slot.profile ?? c.profile) && !slot.gift) c.lowQuality = true; // paga, mas falha (RN-15)
      value = pastryValue(salePrice(s, itemId), nota, s.config.reputation, c.group ? tablePremium(s) : 1);
      if (ITEMS[itemId].base === 'especial') s.stats.especial++;
    } else {
      value = drinkValue(salePrice(s, itemId), s.config.reputation);
      addCharm(s, CHARM_CHORINHO * s.config.promo.chorinho); // chorinho dá encanto por nível (RN-123)
      s.stats.drinks++;
    }
    if (slot.gift) {
      value = 0; // brinde não paga: dá encanto e custa insumo (RN-122)
      addCharm(s, CHARM_GIFT);
      s.stats.giftCost += itemCost(itemId);
      s.stats.gifts++;
    }
    owed += value;
    emit(s, 'entregou', c.id);
  }
  c.owed += owed;
  dropTicket(s, t);
  emit(s, 'ticket_entregue', t.id);
  if (c.lowQuality || c.wrong) failOrder(s, c, FAIL_WEIGHT.counter);
  else if (!c.failed) recordSuccess(s);
  if (s.dirt >= DIRT_FAIL_LIMIT) recordFailure(s, DIRT_FAIL_WEIGHT); // entregue com a barraca imunda (RN-133)
  addDirt(s, DIRT_PER_ORDER * (by?.courses.includes('higiene') ? HYGIENE_DIRT_FACTOR : 1)); // RN-131, RN-118
  s.stats.served++;
  if (c.group) {
    // o grupo come na mesa e paga depois, no balcão (RN-82, RN-87)
    const i = s.customers.indexOf(c);
    if (i >= 0) s.customers.splice(i, 1);
    c.place = 'comendo';
    c.timer = EAT_SECONDS;
    s.eating.push(c);
    emit(s, 'grupo_comendo', c.id);
  } else {
    s.coins.push({ id: newId(s), amount: roundCents(c.owed) });
    removeCustomer(s, c);
  }
}
