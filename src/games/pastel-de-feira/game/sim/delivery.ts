import {
  APP_CAP_BASE, APP_CAP_HIGH, APP_CAP_MID, APP_CAP_PARTNER, APP_FEE, APP_MOTO_MAX_ORDERS, APP_MOTO_WAIT, APP_MOTO_WAIT_LOW_REP,
  APP_OFFER_INTERVAL, APP_OFFER_SECONDS, APP_ORDER_MAX, APP_ORDER_MIN, APP_PICKUP_DELAY, APP_TRANSPORT_LOSS, APP_LOW_QUALITY,
  CHARM_GIFT, FAIL_WEIGHT, LOW_REPUTATION_LIMIT,
} from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import { FORECAST } from '../data/events';
import { giftFor, itemCost, menuEntry } from './customers';
import { isRaining } from './world';
import { addCharm } from './reputation';
import { currentQuality, qualityFactor, reputationPremium, roundCents } from './quality';
import { recordFailure, recordSuccess } from './reputation';
import { warmReady, warmedCount, warmerCapacity } from './stations/warmer';
import { emit, newId, now, type Comanda, type DayState, type Ready } from './state';

/** Teto diário de comandas aceitas pela reputação; Conta Parceira soma 4 (RN-95). */
export function dailyCap(s: DayState): number {
  const rep = s.config.reputation;
  const base = rep >= 4.5 ? APP_CAP_HIGH : rep >= 3.5 ? APP_CAP_MID : APP_CAP_BASE;
  return base + (s.config.delivery.partner ? APP_CAP_PARTNER : 0);
}

export const deliveryOn = (s: DayState): boolean => s.config.delivery.on;

function makeOffer(s: DayState): void {
  const rng = s.rng.app;
  const pool = s.config.menu.filter((m) => ITEMS[m.item].kind === 'salgado');
  if (pool.length === 0) return;
  const n = rng.int(APP_ORDER_MIN, APP_ORDER_MAX);
  const items: ItemId[] = [];
  for (let i = 0; i < n; i++) items.push(rng.weighted(pool, (m) => m.weight ?? 1)!.item);
  s.offers.push({ id: newId(s), items, left: APP_OFFER_SECONDS });
  emit(s, 'oferta_app');
}

/** Aceita uma oferta, de qualquer posição (PA-14). Precisa de embalagem do app (RN-39a) e do teto (RN-95). */
export function acceptOffer(s: DayState, offerId: number): boolean {
  if (!deliveryOn(s) || s.acceptedToday >= dailyCap(s) || s.consumables.embalagem < 1) return false;
  const i = s.offers.findIndex((o) => o.id === offerId);
  if (i < 0) return false;
  const [offer] = s.offers.splice(i, 1);
  s.consumables.embalagem--;
  s.acceptedToday++;
  const items = [...offer.items];
  const gifts = items.map(() => false);
  const gift = giftFor(s, items); // o brinde vale no app, sem mudar o tamanho da oferta (RN-120, RN-121)
  if (gift) {
    items.push(gift);
    gifts.push(true);
  }
  s.comandas.push({ id: offer.id, items, packed: items.map(() => null), gifts, pickupAt: now(s) + APP_PICKUP_DELAY, motoboy: null });
  emit(s, 'oferta_aceita', offer.id);
  return true;
}

export const isComplete = (c: Comanda): boolean => c.packed.every((p) => p !== null);

/** Reserva um pastel pronto para a primeira comanda que o pede (embalar, RN-96). */
export function packPastry(s: DayState, readyId: number): boolean {
  const r = s.ready.find((x) => x.id === readyId);
  if (!r || r.reservedFor !== undefined) return false;
  for (const c of s.comandas) {
    if (c.motoboy !== null && isComplete(c)) continue;
    const i = c.items.findIndex((it, k) => c.packed[k] === null && ITEMS[it].base === ITEMS[r.item].base);
    if (i < 0) continue;
    c.packed[i] = r.id;
    r.reservedFor = c.id;
    emit(s, 'comanda_embalada', c.id);
    if (isComplete(c)) shelve(s, c);
    return true;
  }
  return false;
}

/** Comanda pronta ocupa vagas da estufa até o motoboy chegar; sem vaga fica na bancada da Expedição (RN-96). */
function shelve(s: DayState, c: Comanda): void {
  for (const id of c.packed) {
    if (id !== null && warmerCapacity(s) > warmedCount(s)) warmReady(s, id);
  }
}

function pickup(s: DayState, c: Comanda): void {
  let low = false;
  let revenue = 0;
  const loss = s.config.equipment.thermalBag ? 0 : APP_TRANSPORT_LOSS;
  c.packed.forEach((id, k) => {
    const r = s.ready.find((x) => x.id === id) as Ready | undefined;
    if (!r) return;
    const nota = Math.max(0, currentQuality(r, now(s)) - loss);
    if (nota < APP_LOW_QUALITY) low = true;
    if (c.gifts[k]) {
      addCharm(s, CHARM_GIFT);
      s.stats.giftCost += itemCost(c.items[k]);
      s.stats.gifts++;
      s.ready.splice(s.ready.indexOf(r), 1);
      return;
    }
    const price = menuEntry(s, c.items[k])?.price ?? ITEMS[c.items[k]].reference;
    revenue += price * (1 - APP_FEE) * qualityFactor(nota) * reputationPremium(s.config.reputation);
    s.ready.splice(s.ready.indexOf(r), 1);
  });
  revenue = roundCents(revenue);
  s.stats.revenue = roundCents(s.stats.revenue + revenue);
  s.stats.appRevenue = roundCents(s.stats.appRevenue + revenue);
  s.stats.appPicked++;
  s.stats.served++;
  if (low) recordFailure(s, FAIL_WEIGHT.appLowQuality);
  else recordSuccess(s);
  emit(s, 'comanda_entregue', c.id);
}

function cancel(s: DayState, c: Comanda): void {
  for (const id of c.packed) {
    const i = s.ready.findIndex((x) => x.id === id);
    if (i >= 0) s.ready.splice(i, 1); // os pastéis já feitos se perdem (RN-94)
  }
  s.stats.appCancelled++;
  recordFailure(s, FAIL_WEIGHT.appLate);
  emit(s, 'comanda_cancelada', c.id);
}

function finish(s: DayState, c: Comanda): void {
  s.comandas.splice(s.comandas.indexOf(c), 1);
}

/** Ofertas, aceite automático, motoboys, retirada e cancelamento (RN-90–96). */
export function updateDelivery(s: DayState, dt: number): void {
  if (!deliveryOn(s)) return;
  for (let i = s.offers.length - 1; i >= 0; i--) {
    s.offers[i].left -= dt;
    if (s.offers[i].left <= 0) s.offers.splice(i, 1); // oferta ignorada expira sem penalidade
  }
  s.offerLeft -= dt;
  if (s.offerLeft <= 0) {
    if (s.acceptedToday < dailyCap(s)) makeOffer(s);
    s.offerLeft = (APP_OFFER_INTERVAL * (0.5 + s.rng.app.next())) / (isRaining(s) ? FORECAST.rainApp : 1); // chuva: comandas +50% (RN-151)
  }
  if (s.config.delivery.auto && s.workers.some((w) => w.position === 'expedicao')) {
    for (const o of [...s.offers]) acceptOffer(s, o.id);
  }
  // motoboy chega no horário e leva até 2 comandas (RN-92)
  const due = s.comandas.filter((c) => c.motoboy === null && c.pickupAt <= now(s));
  while (due.length > 0) {
    const take = due.splice(0, APP_MOTO_MAX_ORDERS);
    const id = newId(s);
    for (const c of take) c.motoboy = id;
    s.motoboys.push({ id, comandas: take.map((c) => c.id), waitLeft: APP_MOTO_WAIT * (s.config.reputation < LOW_REPUTATION_LIMIT ? APP_MOTO_WAIT_LOW_REP : 1) });
    emit(s, 'moto_chegou', id);
  }
  for (let i = s.motoboys.length - 1; i >= 0; i--) {
    const m = s.motoboys[i];
    m.waitLeft -= dt;
    const mine = m.comandas.map((id) => s.comandas.find((c) => c.id === id)).filter((c): c is Comanda => c !== undefined);
    for (const c of mine) {
      if (isComplete(c)) {
        pickup(s, c);
        finish(s, c);
        m.comandas.splice(m.comandas.indexOf(c.id), 1);
      }
    }
    if (m.comandas.length === 0) {
      s.motoboys.splice(i, 1);
    } else if (m.waitLeft <= 0) {
      for (const id of m.comandas) {
        const c = s.comandas.find((x) => x.id === id);
        if (c) {
          cancel(s, c);
          finish(s, c);
        }
      }
      s.motoboys.splice(i, 1);
    }
  }
}
