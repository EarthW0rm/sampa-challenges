import {
  APP_CAP_BASE, APP_CAP_HIGH, APP_CAP_MID, APP_CAP_PARTNER, APP_OFFER_INTERVAL, APP_OFFER_SECONDS, APP_ORDER_MAX, APP_ORDER_MIN, APP_PICKUP_DELAY,
} from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import { FORECAST } from '../data/events';
import { giftFor } from './customers';
import { isRaining } from './world';
import { canCover } from './production';
import { emit, newId, now, type DayState, type OrderLine } from './state';
import { createTicket } from './tickets';

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

/**
 * Aceita uma oferta, de qualquer posição (PA-14). Precisa de embalagem do app (RN-39a) e do teto (RN-95).
 * O aceite cria a comanda APP e a sacola na Expedição; o motoboy chega 35 s depois (RN-91, RN-193).
 */
export function acceptOffer(s: DayState, offerId: number): boolean {
  if (!deliveryOn(s) || s.acceptedToday >= dailyCap(s) || s.consumables.embalagem < 1) return false;
  const i = s.offers.findIndex((o) => o.id === offerId);
  if (i < 0) return false;
  const [offer] = s.offers.splice(i, 1);
  s.consumables.embalagem--;
  s.acceptedToday++;
  const slots: OrderLine[] = offer.items.map((item) => ({ item, filled: null }));
  const gift = giftFor(s, offer.items); // o brinde vale no app, sem mudar o tamanho da oferta (RN-120, RN-121)
  if (gift) slots.push({ item: gift, gift: true, filled: null });
  const t = createTicket(s, 'app', null, slots);
  t.pickupAt = now(s) + APP_PICKUP_DELAY;
  emit(s, 'oferta_aceita', offer.id);
  return true;
}

/** Aceite automático (RN-95): só com alguém na Expedição e insumo para todos os itens da oferta. */
function autoAccept(s: DayState): void {
  if (!s.config.delivery.auto || !s.workers.some((w) => w.position === 'expedicao')) return;
  for (const o of [...s.offers]) if (canCover(s, o.items)) acceptOffer(s, o.id);
}

/** Ofertas do app e aceite automático (RN-90, RN-91, RN-95). A retirada é da fila da Expedição (`dispatch.ts`). */
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
  autoAccept(s);
}
