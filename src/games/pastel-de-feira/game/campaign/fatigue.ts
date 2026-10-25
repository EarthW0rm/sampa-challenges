import { ITEMS } from '../data/recipes';
import type { Campaign } from './types';

/** Fadiga de cardápio (RN-30c): vale só com 4 ou mais receitas compradas; versões não contam como receitas novas. */
export const FATIGUE_MIN_RECIPES = 4;
export const FATIGUE_FREE_DAYS = 3;
export const FATIGUE_STEP = 0.1;
export const FATIGUE_MAX = 0.4;

export function recipeCount(c: Campaign): number {
  const bases = new Set<string>();
  for (const id of c.owned.items) if (ITEMS[id].kind !== 'bebida') bases.add(ITEMS[id].base);
  return bases.size;
}

/** Fator de procura (1 = sem fadiga). Contado pela receita base, somando todas as versões (D-02). */
export function fatigueFactor(c: Campaign, base: string): number {
  if (recipeCount(c) < FATIGUE_MIN_RECIPES) return 1;
  const days = c.fatigue[base] ?? 0;
  return 1 - Math.min(FATIGUE_MAX, FATIGUE_STEP * Math.max(0, days - FATIGUE_FREE_DAYS));
}

/** Atualiza os contadores no fechamento: +1 para quem esteve no cardápio, zera para quem saiu. */
export function advanceFatigue(c: Campaign): Record<string, number> {
  const next: Record<string, number> = {};
  // várias versões da mesma receita no mesmo dia contam 1 dia só
  for (const id of [...c.menu.salgados, ...c.menu.doces]) next[ITEMS[id].base] = (c.fatigue[ITEMS[id].base] ?? 0) + 1;
  return next;
}
