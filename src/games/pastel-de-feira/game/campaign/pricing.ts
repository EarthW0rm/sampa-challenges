import { PRICE_MAX_FACTOR, PRICE_MIN_FACTOR, PRICE_STEP } from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';

/** Preço de venda dentro da faixa (50% a 250% da referência) e do passo de R$ 0,50 (RN-10). */
export function clampPrice(item: ItemId, price: number): number {
  const ref = ITEMS[item].reference;
  const lo = Math.ceil((ref * PRICE_MIN_FACTOR) / PRICE_STEP) * PRICE_STEP;
  const hi = Math.floor((ref * PRICE_MAX_FACTOR) / PRICE_STEP) * PRICE_STEP;
  const snapped = Math.round(price / PRICE_STEP) * PRICE_STEP;
  return Math.max(lo, Math.min(hi, Number.isFinite(snapped) ? snapped : lo));
}

/** Preço inicial sugerido: 90% da referência (teto do Econômico), no passo de R$ 0,50. */
export function defaultPrice(item: ItemId): number {
  const raw = Math.floor((ITEMS[item].reference * 0.9) / PRICE_STEP) * PRICE_STEP;
  return clampPrice(item, raw);
}
