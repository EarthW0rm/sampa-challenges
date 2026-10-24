import { BUYER_DISCOUNT } from '../../data/office';
import { CONSUMABLES, INGREDIENTS, type ConsumableId, type IngredientId } from '../../data/catalog';
import { capacityFree, cloneCampaign, expiryFor, round2 } from '../campaign';
import type { ActionResult, Campaign } from '../types';

/** Desconto de compra do pasteleiro (Negociante, Comprador): gancho das US-117 e US-120. */
export function purchaseFactor(c: Campaign): number {
  return (c.roles.includes('comprador') ? BUYER_DISCOUNT : 1);
}

/** Custo unitário de um insumo para esta campanha. */
export const unitCost = (c: Campaign, ing: IngredientId): number =>
  Math.round(INGREDIENTS[ing].cost * purchaseFactor(c) * 10000) / 10000;

const isCount = (n: number): boolean => Number.isInteger(n) && n >= 1;

/** Comprar insumo (RN-32, RN-33): respeita caixa (RN-53) e capacidade (RN-38). */
export function buyIngredient(c: Campaign, ing: IngredientId, qty: number): ActionResult {
  if (!INGREDIENTS[ing] || !isCount(qty)) return { ok: false, motivo: 'limite' };
  const cost = round2(unitCost(c, ing) * qty);
  if (cost > c.cash + 1e-9) return { ok: false, motivo: 'semCaixa' };
  if (qty > capacityFree(c)) return { ok: false, motivo: 'semCapacidade' };
  const next = cloneCampaign(c);
  next.cash = round2(next.cash - cost);
  const unit = unitCost(c, ing);
  const expires = expiryFor(c, ing);
  const lot = next.inventory.find((l) => l.ingredient === ing && l.unitCost === unit && l.expires === expires && !l.inCooler);
  if (lot) lot.qty += qty;
  else next.inventory.push({ ingredient: ing, qty, unitCost: unit, expires, inCooler: false });
  next.boughtToday += qty;
  return { ok: true, campaign: next };
}

const CONSUMABLE_MAX = 999;

/** Comprar consumível: não ocupa capacidade e não estraga (RN-39a). */
export function buyConsumable(c: Campaign, id: ConsumableId, qty: number): ActionResult {
  const item = CONSUMABLES[id];
  if (!item || !isCount(qty) || c.consumables[id] + qty > CONSUMABLE_MAX) return { ok: false, motivo: 'limite' };
  const cost = round2(item.cost * qty);
  if (cost > c.cash + 1e-9) return { ok: false, motivo: 'semCaixa' };
  const next = cloneCampaign(c);
  next.cash = round2(next.cash - cost);
  next.consumables[id] += qty;
  return { ok: true, campaign: next };
}
