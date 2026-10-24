import { CONSUMABLE_IDS, type ConsumableId, type IngredientId } from '../data/catalog';
import { itemIngredients, ITEMS } from '../data/recipes';
import { ARRIVAL_BASE_INTERVAL, ARRIVAL_DAILY_DECAY, ARRIVAL_MIN_INTERVAL, DAY_SECONDS, HOUR_SECONDS, LOW_REPUTATION_ARRIVAL, LOW_REPUTATION_LIMIT, ORDER_DRINK_CHANCE, ORDER_PASTRIES_MAX, ORDER_PASTRIES_MIN, PEAK_END_HOUR, PEAK_FACTOR, PEAK_START_HOUR } from '../constants';
import { ceilingFor, profileShares } from '../sim/customers';
import { capacityFree, menuEntries, stockOf } from './campaign';
import type { Campaign } from './types';

/** Doces por cliente (RN-30e): 25%, 35% à tarde. */
const DESSERT_CHANCE = 0.28;
const SAFETY = 1.15;

export interface Suggestion {
  ingredients: Record<IngredientId, number>;
  consumables: Record<ConsumableId, number>;
}

/** Clientes esperados no dia (RN-02, RN-03), com o pico das 10h às 12h. */
export function expectedCustomers(c: Campaign): number {
  let interval = Math.max(ARRIVAL_MIN_INTERVAL, ARRIVAL_BASE_INTERVAL * Math.pow(1 - ARRIVAL_DAILY_DECAY, c.day - 1));
  if (c.reputation < LOW_REPUTATION_LIMIT) interval /= LOW_REPUTATION_ARRIVAL;
  const peak = (PEAK_END_HOUR - PEAK_START_HOUR) * HOUR_SECONDS;
  return ((DAY_SECONDS - peak) + peak * PEAK_FACTOR) / interval;
}

/** Fração dos clientes que consegue comprar algum pastel pelo preço do cardápio (RN-11, RN-13). */
function buyingShare(c: Campaign): number {
  const entries = menuEntries(c).filter((m) => ITEMS[m.item].kind !== 'bebida');
  const shares = profileShares(c.day, 11, 1, c.theme);
  let share = 0;
  for (const p of ['economico', 'padrao', 'exigente'] as const) {
    const ceiling = ceilingFor(p, c.reputation);
    if (entries.some((m) => m.price <= ceiling * ITEMS[m.item].reference + 1e-9)) share += shares[p];
  }
  return share;
}

/** Compra sugerida pela demanda esperada (RN-36), descontando o estoque e limitada à capacidade livre. */
export function suggestPurchase(c: Campaign): Suggestion {
  const entries = menuEntries(c);
  const buyers = expectedCustomers(c) * buyingShare(c);
  const pastryEntries = entries.filter((m) => ITEMS[m.item].kind === 'salgado');
  const dessertEntries = entries.filter((m) => ITEMS[m.item].kind === 'doce');
  const drinkEntries = entries.filter((m) => ITEMS[m.item].kind === 'bebida');
  const avgPastries = (ORDER_PASTRIES_MIN + ORDER_PASTRIES_MAX) / 2;

  const need: Record<IngredientId, number> = {};
  const share = (list: typeof entries, units: number) => {
    const total = list.reduce((n, m) => n + (m.weight ?? 1), 0);
    if (total <= 0) return;
    for (const m of list) {
      const u = (units * (m.weight ?? 1)) / total;
      for (const [ing, per] of itemIngredients(ITEMS[m.item])) need[ing] = (need[ing] ?? 0) + u * per;
    }
  };
  share(pastryEntries, buyers * avgPastries);
  share(dessertEntries, buyers * DESSERT_CHANCE);
  share(drinkEntries, buyers * ORDER_DRINK_CHANCE);

  const ingredients: Record<IngredientId, number> = {};
  let total = 0;
  for (const [ing, n] of Object.entries(need)) {
    const want = Math.max(0, Math.ceil(n * SAFETY) - stockOf(c, ing));
    if (want > 0) {
      ingredients[ing] = want;
      total += want;
    }
  }
  const free = capacityFree(c);
  if (total > free && total > 0) {
    const k = free / total;
    for (const ing of Object.keys(ingredients)) ingredients[ing] = Math.floor(ingredients[ing] * k);
  }

  const pastries = buyers * (avgPastries + (dessertEntries.length ? DESSERT_CHANCE : 0));
  const consumables = Object.fromEntries(CONSUMABLE_IDS.map((id) => [id, 0])) as Record<ConsumableId, number>;
  consumables.saquinho = Math.max(0, Math.ceil(pastries * SAFETY) - c.consumables.saquinho);
  consumables.copo = drinkEntries.length ? Math.max(0, Math.ceil(buyers * ORDER_DRINK_CHANCE * SAFETY) - c.consumables.copo) : 0;
  return { ingredients, consumables };
}

/** A compra sugerida aparece nos dias 1 a 3 ou com Comprador contratado (RN-36). */
export const showSuggestion = (c: Campaign): boolean => c.day <= 3;
