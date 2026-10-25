import { BENCH_CAPACITY, BENCH_TRAY_MAX } from '../../constants';
import { INGREDIENTS, type IngredientId } from '../../data/catalog';
import { fillingKey, ITEM_BY_FILLING, ITEMS, itemIngredients, type ItemId } from '../../data/recipes';
import { swapDemand, menuEntry } from '../customers';
import { isAt } from '../pasteleiro';
import { emit, newId, type Assembled, type DayState } from '../state';
import { consumeItem, stockQty } from '../stock';

/** Clicar num ingrediente de recheio (RN-42). Temperos entram sozinhos ao fechar; massa também. */
export function addIngredient(s: DayState, id: IngredientId): boolean {
  if (!isAt(s, 'bancada')) return false;
  const ing = INGREDIENTS[id];
  if (!ing || ing.kind === 'massa' || ing.kind === 'tempero') return false;
  if (s.tray.length >= BENCH_TRAY_MAX) return false;
  const inTray = s.tray.filter((x) => x === id).length;
  if (stockQty(s, id) < inTray + 1) {
    swapDemand(s);
    return false;
  }
  s.tray.push(id);
  return true;
}

/** Fechar o pastel: reconhece a receita pelo recheio e consome os insumos (RN-34, RN-42). */
export function closeAssembly(s: DayState): boolean {
  if (!isAt(s, 'bancada') || s.tray.length === 0) return false;
  if (s.assembled.length >= BENCH_CAPACITY) return false;
  const item = ITEM_BY_FILLING.get(fillingKey(s.tray));
  if (!item || !menuEntry(s, item.id)) return false;
  for (const [ing, need] of itemIngredients(item)) if (stockQty(s, ing) < need) return false;
  s.tray.length = 0;
  return assembleItem(s, item.id) !== null;
}

/** Monta um pastel direto do estoque (pasteleiro e funcionários usam o mesmo caminho). */
export function assembleItem(s: DayState, id: ItemId, bonus = 0): Assembled | null {
  const item = ITEMS[id];
  if (!item || s.assembled.length >= BENCH_CAPACITY) return null;
  for (const [ing, need] of itemIngredients(item)) if (stockQty(s, ing) < need) return null;
  consumeItem(s, item);
  const a: Assembled = { id: newId(s), item: item.id, bonus: bonus || undefined };
  s.assembled.push(a);
  emit(s, 'montou', a.id);
  swapDemand(s);
  return a;
}

export function clearTray(s: DayState): boolean {
  if (!isAt(s, 'bancada') || s.tray.length === 0) return false;
  s.tray.length = 0;
  return true;
}

export function selectAssembled(s: DayState, id: number): boolean {
  if (!isAt(s, 'bancada') || !s.assembled.some((a) => a.id === id)) return false;
  s.selectedAssembled = id;
  return true;
}
