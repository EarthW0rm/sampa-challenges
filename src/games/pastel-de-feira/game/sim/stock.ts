import { CHORINHO_DOSE } from '../constants';
import { itemIngredients, ITEMS, type Item, type ItemId } from '../data/recipes';
import type { IngredientId } from '../data/catalog';
import type { DayState } from './state';

/** Unidades de um insumo em estoque (todos os lotes). */
export function stockQty(s: DayState, ing: IngredientId): number {
  let n = 0;
  for (const l of s.stock) if (l.ingredient === ing) n += l.qty;
  return n;
}

/** Quantas unidades do item dá para fazer com o estoque (e o copo, no caso do caldo). */
/** Insumos de uma unidade: o chorinho soma 0,1 dose de cana por nível ao caldo (RN-123). */
export function needs(s: DayState, item: Item): Map<IngredientId, number> {
  const m = itemIngredients(item);
  if (item.kind === 'bebida') m.set('cana', Math.round(((m.get('cana') ?? 1) + CHORINHO_DOSE * s.config.promo.chorinho) * 100) / 100);
  return m;
}

export function unitsMakeable(s: DayState, item: Item): number {
  let min = Infinity;
  for (const [ing, need] of needs(s, item)) min = Math.min(min, Math.floor(stockQty(s, ing) / need + 1e-9));
  if (item.kind === 'bebida') min = Math.min(min, s.consumables.copo);
  return Number.isFinite(min) ? min : 0;
}

export const canMake = (s: DayState, item: Item): boolean => unitsMakeable(s, item) >= 1;

/** Consome `n` unidades de um insumo, da mais antiga (menor validade) para a mais nova (RN-34). */
export function consumeIngredient(s: DayState, ing: IngredientId, n: number): void {
  const lots = s.stock.filter((l) => l.ingredient === ing && l.qty > 0).sort((a, b) => a.daysLeft - b.daysLeft);
  let left = n;
  for (const l of lots) {
    const take = Math.min(l.qty, left);
    l.qty -= take;
    left -= take;
    if (left <= 0) break;
  }
}

/** Consome os insumos de uma unidade do item (sem o copo: o copo sai na moenda). */
export function consumeItem(s: DayState, item: Item): void {
  for (const [ing, need] of itemIngredients(item)) consumeIngredient(s, ing, need);
}

export const itemOf = (id: ItemId): Item => ITEMS[id];
