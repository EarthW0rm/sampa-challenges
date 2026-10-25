import { ORDERS } from '../../data/office';
import { ITEMS, itemIngredients } from '../../data/recipes';
import { Rng } from '../../rng';
import { cloneCampaign, round2, stockOf } from '../campaign';
import type { ActionResult, BigOrderOffer, Campaign } from '../types';

/** Ofertas de encomenda do Preparo: de 0 a 2 (0 a 3 com Despachante), sorteadas por semente e calendário (RN-102). */
export function rollOrders(c: Campaign): BigOrderOffer[] {
  if (!c.owned.office) return [];
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
  if (!c.owned.office) return { ok: false, motivo: 'requer' };
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
