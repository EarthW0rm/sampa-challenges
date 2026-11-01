import { ORDERS } from '../../data/office';
import { ITEMS, itemIngredients } from '../../data/recipes';
import { Rng } from '../../rng';
import { cloneCampaign, round2, stockOf } from '../campaign';
import type { ActionResult, BigOrderOffer, Campaign } from '../types';

/** Encomendas exigem o escritório e a área de delivery: a Expedição monta e entrega a caixa (RN-102, CE-22). */
export const ordersAvailable = (c: Campaign): boolean => c.owned.office && c.owned.delivery;

/** Ofertas de encomenda do Preparo: de 0 a 2 (0 a 3 com Despachante), sorteadas por semente e calendário (RN-102). */
export function rollOrders(c: Campaign): BigOrderOffer[] {
  if (!ordersAvailable(c)) return [];
  const rng = new Rng(c.seed).fork(`encomendas:${c.calendar}`);
  const max = c.roles.includes('despachante') ? ORDERS.maxOffersWithDispatcher : ORDERS.maxOffers;
  const pool = c.owned.items.filter((id) => ITEMS[id].kind === 'salgado');
  const n = rng.int(0, max);
  const out: BigOrderOffer[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const item = rng.pick(pool);
    const qty = rng.int(ORDERS.minQty, ORDERS.maxQty);
    const hour = ORDERS.firstHour + rng.int(0, Math.round((ORDERS.lastHour - ORDERS.firstHour) * 2)) / 2;
    const pay = round2(qty * ITEMS[item].reference * ORDERS.payFactor);
    out.push({ id: `${c.calendar}-enc-${i}`, dayId: c.calendar * 10 + i + 1, item, qty, hour, pay, fine: round2(pay * ORDERS.fineFactor) });
  }
  return out.filter((o) => !c.orders.some((a) => a.id === o.id));
}

/** Aceita uma encomenda do dia. Falta de insumo é só avisada (ver `orderShortfall`), não impede (spec 4). */
export function acceptOrder(c: Campaign, id: string): ActionResult {
  if (!ordersAvailable(c)) return { ok: false, motivo: 'requer' };
  const offer = rollOrders(c).find((o) => o.id === id);
  if (!offer) return { ok: false, motivo: 'requer' };
  const next = cloneCampaign(c);
  next.orders.push(offer);
  return { ok: true, campaign: next };
}

/** Unidades do pedido que o estoque atual não cobre (para o aviso ao aceitar). */
export function orderShortfall(c: Campaign, o: BigOrderOffer): number {
  let can = Infinity;
  for (const [ing, per] of itemIngredients(ITEMS[o.item])) can = Math.min(can, Math.floor(stockOf(c, ing) / per));
  return Math.max(0, o.qty - (Number.isFinite(can) ? can : 0));
}

/** Há funcionário fixo na Expedição: condição do aceite automático no Preparo (RN-95, RN-102). */
export const fixedDispatcher = (c: Campaign): boolean => c.staff.some((w) => w.mode === 'fixo' && w.position === 'expedicao');

/**
 * Aceite automático das encomendas ao abrir a feira (RN-102): com o toggle ligado e alguém fixo na Expedição,
 * aceita cada oferta que o estoque comprado cobre, somadas às unidades das encomendas já aceitas.
 */
export function autoAcceptOrders(c: Campaign): Campaign {
  if (!c.autoAccept || !fixedDispatcher(c)) return c;
  let out = c;
  for (const offer of rollOrders(c)) {
    const reserved = new Map<string, number>();
    for (const o of out.orders) for (const [ing, per] of itemIngredients(ITEMS[o.item])) reserved.set(ing, (reserved.get(ing) ?? 0) + per * o.qty);
    let fits = true;
    for (const [ing, per] of itemIngredients(ITEMS[offer.item])) if (stockOf(out, ing) - (reserved.get(ing) ?? 0) < per * offer.qty) fits = false;
    if (!fits) continue;
    const r = acceptOrder(out, offer.id);
    if (r.ok) out = r.campaign;
  }
  return out;
}
