import { DIRT_FAIL_LIMIT, DIRT_FAIL_WEIGHT, DIRT_PER_ORDER, EAT_SECONDS, HYGIENE_DIRT_FACTOR, FAIL_WEIGHT, NO_BAG_PENALTY, CHARM_GIFT, CHARM_CHORINHO } from '../../constants';
import { addDirt } from '../dirt';
import { PATIENCE_COURSE_BONUS } from '../../data/staff';
import { ITEMS, type ItemId } from '../../data/recipes';
import type { ItemRef } from '../../types';
import { failOrder, itemCost, minQuality, removeCustomer, salePrice, tablePremium } from '../customers';
import { addCharm } from '../reputation';
import { isAt } from '../pasteleiro';
import { currentQuality, drinkValue, pastryValue, roundCents } from '../quality';
import { recordFailure, recordSuccess } from '../reputation';
import { collectPayment } from './tables';
import { emit, newId, now, type Customer, type DayState, type OrderLine, type Worker } from '../state';

/** Anota um cliente (RN-42). Quem anota com o curso de Atendimento deixa o cliente mais paciente (RN-118). */
export function noteOrder(s: DayState, c: Customer, by?: Worker): void {
  c.state = 'anotado';
  if (by?.courses.includes('atendimento')) {
    c.patience += c.patienceMax * PATIENCE_COURSE_BONUS;
    c.patienceMax *= 1 + PATIENCE_COURSE_BONUS;
  }
  emit(s, 'anotou', c.id);
}

/** Anotar o cliente da frente: o primeiro da fila ainda não anotado (pasteleiro, no balcão). */
export function takeOrder(s: DayState): boolean {
  if (!isAt(s, 'balcao')) return false;
  const c = s.customers.find((x) => x.state === 'aguardando' && x.place === 'fila');
  if (!c) return false;
  noteOrder(s, c);
  return true;
}

/** Anotar o pedido de um grupo na mesa (pasteleiro nas mesas, RN-83). */
export function takeTableOrder(s: DayState): boolean {
  if (!isAt(s, 'mesas')) return false;
  const c = s.customers.find((x) => x.state === 'aguardando' && x.place === 'mesa');
  if (!c) return false;
  noteOrder(s, c);
  return true;
}

/** Recolhe as moedas do balcão (RN-42). Cada moeda sai uma vez só. */
export function takeCoins(s: DayState): boolean {
  if (s.coins.length === 0) return false;
  let total = 0;
  for (const coin of s.coins) total += coin.amount;
  s.coins.length = 0;
  s.stats.revenue = roundCents(s.stats.revenue + total);
  emit(s, 'cobrou');
  return true;
}

export const collectCoins = (s: DayState): boolean => isAt(s, 'balcao') && takeCoins(s);

/** O item entregue atende à linha do pedido? Só o Exigente exige a versão exata (RN-18). */
export function lineMatches(c: Customer, line: OrderLine, delivered: ItemId): boolean {
  if (line.delivered !== null) return false;
  const want = ITEMS[line.item];
  const got = ITEMS[delivered];
  if ((want.kind === 'bebida') !== (got.kind === 'bebida')) return false;
  return (line.profile ?? c.profile) === 'exigente' ? line.item === delivered : want.base === got.base;
}

/** Item pronto de uma referência (pastel ou copo). */
export function itemOfRef(s: DayState, ref: ItemRef): ItemId | undefined {
  return ref.kind === 'pastel' ? s.ready.find((r) => r.id === ref.id)?.item : s.cups.find((x) => x.id === ref.id)?.item;
}

/** Entrega um item pronto a um cliente anotado (RN-42, RN-63). Devolve false só se a ação não pôde valer. */
export function deliverItem(s: DayState, ref: ItemRef, customerId: number, by?: Worker): boolean {
  const c = s.customers.find((x) => x.id === customerId);
  if (!c || c.state !== 'anotado') return false;
  const pastry = ref.kind === 'pastel' ? s.ready.find((r) => r.id === ref.id && r.reservedFor === undefined) : undefined;
  const cup = ref.kind === 'copo' ? s.cups.find((x) => x.id === ref.id) : undefined;
  const itemId = pastry?.item ?? cup?.item;
  if (!itemId) return false;

  const pending = c.lines.filter((l) => lineMatches(c, l, itemId));
  const line = pending.find((l) => l.item === itemId) ?? pending[0];
  if (!line) {
    // Item errado: o cliente recusa, o item volta e o pedido vira falha, uma vez só (RN-63).
    if (!c.wrong) {
      c.wrong = true;
      s.stats.wrong++;
    }
    failOrder(s, c, FAIL_WEIGHT.counter);
    emit(s, 'item_errado', c.id);
    return true;
  }

  const price = salePrice(s, itemId);
  let value: number;
  if (pastry) {
    let nota = currentQuality(pastry, now(s));
    if (s.consumables.saquinho > 0) s.consumables.saquinho--;
    else nota = Math.max(0, nota - NO_BAG_PENALTY); // sem saquinho (RN-28)
    if (nota < minQuality(s, line.profile ?? c.profile) && !line.gift) c.lowQuality = true; // paga, mas falha (RN-15)
    value = pastryValue(price, nota, s.config.reputation, c.group ? tablePremium(s) : 1);
    if (ITEMS[itemId].base === 'especial') s.stats.especial++;
    s.ready.splice(s.ready.indexOf(pastry), 1);
  } else {
    value = drinkValue(price, s.config.reputation);
    addCharm(s, CHARM_CHORINHO * s.config.promo.chorinho); // chorinho dá encanto por nível (RN-123)
    s.stats.drinks++;
    s.cups.splice(s.cups.indexOf(cup!), 1);
  }
  if (line.gift) {
    value = 0; // brinde não paga: dá encanto e custa insumo (RN-122)
    addCharm(s, CHARM_GIFT);
    s.stats.giftCost += itemCost(itemId);
    s.stats.gifts++;
  }
  c.owed += value;
  line.delivered = itemId;
  emit(s, 'entregou', c.id);

  if (c.lines.every((l) => l.delivered !== null)) {
    if (c.lowQuality) failOrder(s, c, FAIL_WEIGHT.counter);
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
  return true;
}

/** Entrega pelo pasteleiro: no balcão, ou nas mesas quando o grupo é atendido na mesa (RN-83). */
export function deliver(s: DayState, ref: ItemRef, customerId: number): boolean {
  const c = s.customers.find((x) => x.id === customerId);
  if (!c) return false;
  return isAt(s, c.service === 'mesa' ? 'mesas' : 'balcao') && deliverItem(s, ref, customerId);
}

/** Cobrar o primeiro grupo da fila de pagamento (pasteleiro no balcão, RN-87). */
export const chargeNextGroup = (s: DayState): boolean => collectPayment(s);
