/**
 * Estratégia de Preparo da campanha completa. Parte do robô `equilibrado` de `sim/bots.ts` (`ROBOT`), que
 * fica no limite nos dias 16–20 (repete muitos dias); o padrão compra as receitas caras e as põe no lugar
 * das baratas, o que fecha a campanha em 20–24 rodadas nas sementes testadas. Quantidades em passos de 5
 * e 10 (o que a tela permite) e compra sugerida nos dias 1–3. Cada decisão vira um passo de tela
 * (`PrepStep`) e é aplicada também, pela ação da campanha, a uma cópia esperada: depois de executar os
 * passos na tela, o save tem que ser igual à cópia.
 */
import { buyConsumable, buyIngredient } from '../../../src/games/pastel-de-feira/game/campaign/actions/inventory';
import { setPrice, toggleMenuItem } from '../../../src/games/pastel-de-feira/game/campaign/actions/menu';
import { hire, rollCandidates } from '../../../src/games/pastel-de-feira/game/campaign/actions/staff';
import { capacityFree } from '../../../src/games/pastel-de-feira/game/campaign/campaign';
import { clampPrice } from '../../../src/games/pastel-de-feira/game/campaign/pricing';
import { offers } from '../../../src/games/pastel-de-feira/game/campaign/shop';
import { showSuggestion, suggestPurchase } from '../../../src/games/pastel-de-feira/game/campaign/suggest';
import type { Campaign } from '../../../src/games/pastel-de-feira/game/campaign/types';
import { PRICE_STEP } from '../../../src/games/pastel-de-feira/game/constants';
import { CONSUMABLES, INGREDIENTS, type ConsumableId } from '../../../src/games/pastel-de-feira/game/data/catalog';
import { ITEMS } from '../../../src/games/pastel-de-feira/game/data/recipes';
import { ceilingFor, profileShares } from '../../../src/games/pastel-de-feira/game/sim/customers';

export type PrepStep =
  | { k: 'buy'; id: string; name: string; price: number }
  | { k: 'hire'; name: string; kind: 'Fritador' | 'Geral' }
  | { k: 'menu'; item: string; name: string; on: boolean }
  | { k: 'price'; item: string; name: string; from: number; to: number }
  | { k: 'suggested' }
  | { k: 'ingredient'; id: string; name: string; qty: number }
  | { k: 'consumable'; id: ConsumableId; name: string; qty: number };

/** O que o dia anterior deixou (decide a contratação, como o robô). */
export interface LastDay {
  met: boolean;
  lost: number;
}

/** Ordem de compra do robô equilibrado (sem mesas nem delivery: o piloto só atende o balcão). */
export const BOT_ORDER = ['alarme0', 'grande0', 'caixa-termica', 'estufa', 'placa-salgado', 'frango', 'calabresa', 'tacho-extra', 'caixa-termica', 'm2', 'especial', 'termostato0', 'estufa-grande'];

/** Parâmetros da estratégia. O padrão é mais agressivo que o robô de calibração, para a campanha fechar sem ficar presa nos dias 16–20. */
export interface StrategyOptions {
  order: readonly string[];
  maxBuys: number;
  /** Contrata sempre que a meta falhou (o robô exige também ≥ 4 clientes perdidos). */
  hireOnMiss: boolean;
  staffCap: (day: number) => number;
  /** Troca os salgados baratos pelos de maior referência quando as vagas acabam. */
  premiumMenu: boolean;
}

export const ROBOT: StrategyOptions = { order: BOT_ORDER, maxBuys: 2, hireOnMiss: false, staffCap: (d) => 1 + Math.floor(d / 4), premiumMenu: false };
/** Receitas caras (tíquete maior) e as placas para caberem. */
const PREMIUM_ORDER = ['alarme0', 'grande0', 'estufa', 'placa-salgado', 'especial', 'palmito', 'carne-seca', 'caixa-termica', 'tacho-extra', 'camarao', 'placa-salgado', 'bacalhau', 'm2', 'm2', 'alarme1', 'grande1', 'escorredor', 'termostato0', 'termostato1', 'caixa-termica', 'estufa-grande', 'moenda-motorizada'];
export const DEFAULT_STRATEGY: StrategyOptions = { order: PREMIUM_ORDER, maxBuys: 3, hireOnMiss: false, staffCap: (d) => 1 + Math.floor(d / 4), premiumMenu: true };

export function planPrep(start: Campaign, last?: LastDay, opts: StrategyOptions = DEFAULT_STRATEGY): { steps: PrepStep[]; expected: Campaign } {
  let c = start;
  const steps: PrepStep[] = [];

  // 1) melhorias: até `maxBuys` por dia, mantendo uma reserva de caixa
  const reserve = 250 + c.day * 15;
  const picked = new Set<string>();
  let bought = 0;
  for (const id of opts.order) {
    if (bought >= opts.maxBuys) break;
    const o = offers(c).find((x) => x.id === id && !picked.has(x.id));
    if (!o) continue;
    const r = o.buy(c);
    if (r.ok && r.campaign.cash >= reserve) {
      steps.push({ k: 'buy', id, name: o.name, price: o.price });
      c = r.campaign;
      picked.add(id);
      bought++;
    }
  }

  // 2) equipe: quando o dia anterior perdeu a meta
  if (last && !last.met && (opts.hireOnMiss || last.lost >= 4) && c.cash > 300 && c.staff.length < opts.staffCap(c.day)) {
    const kind = c.staff.some((w) => w.kind === 'fritador') ? 'geral' : 'fritador';
    const cand = rollCandidates(c).find((k) => k.kind === kind) ?? rollCandidates(c)[0];
    if (cand) {
      const r = hire(c, cand.id);
      if (r.ok) {
        steps.push({ k: 'hire', name: cand.name, kind: cand.kind === 'fritador' ? 'Fritador' : 'Geral' });
        c = r.campaign;
      }
    }
  }

  // 3) cardápio: com `premiumMenu`, os salgados de maior referência ocupam as vagas; o resto entra se couber
  if (opts.premiumMenu) {
    const salgados = c.owned.items.filter((id) => ITEMS[id].kind === 'salgado');
    const want = [...salgados].sort((x, y) => ITEMS[y].reference - ITEMS[x].reference || salgados.indexOf(x) - salgados.indexOf(y)).slice(0, c.owned.slotsSalgado);
    for (const id of [...c.menu.salgados]) {
      if (want.includes(id)) continue;
      const r = toggleMenuItem(c, id, false);
      if (r.ok) {
        steps.push({ k: 'menu', item: id, name: ITEMS[id].name, on: false });
        c = r.campaign;
      }
    }
  }
  for (const id of c.owned.items) {
    const on = [...c.menu.salgados, ...c.menu.doces, ...c.menu.bebidas].includes(id);
    if (on) continue;
    const r = toggleMenuItem(c, id, true);
    if (r.ok) {
      steps.push({ k: 'menu', item: id, name: ITEMS[id].name, on: true });
      c = r.campaign;
    }
  }

  // 4) preço que maximiza a receita esperada pelo teto de cada perfil (RN-11, RN-13, RN-14)
  const shares = profileShares(c.day, 11, 1, c.theme);
  for (const id of [...c.menu.salgados, ...c.menu.doces, ...c.menu.bebidas]) {
    const ref = ITEMS[id].reference;
    let best = c.prices[id];
    let bestValue = -1;
    for (let p = clampPrice(id, 0); p <= clampPrice(id, 1e9); p += PRICE_STEP) {
      let share = 0;
      for (const prof of ['economico', 'padrao', 'exigente'] as const) if (p <= ceilingFor(prof, c.reputation) * ref + 1e-9) share += shares[prof];
      if (p * share > bestValue) {
        bestValue = p * share;
        best = p;
      }
    }
    if (best !== c.prices[id]) {
      const r = setPrice(c, id, best);
      if (r.ok) {
        steps.push({ k: 'price', item: id, name: ITEMS[id].name, from: c.prices[id], to: best });
        c = r.campaign;
      }
    }
  }

  // 5) estoque: compra sugerida (dias 1–3, botão "Usar sugerida") ou pelos seletores de quantidade
  const sug = suggestPurchase(c);
  if (showSuggestion(c)) {
    const tried = buySuggested(c, sug);
    if (tried) {
      steps.push({ k: 'suggested' });
      c = tried;
      return { steps, expected: c };
    }
  }
  for (const [ing, qty] of Object.entries(sug.ingredients)) {
    for (let q = Math.min(Math.ceil(qty / 5) * 5, Math.floor(capacityFree(c) / 5) * 5); q >= 5; q -= 5) {
      const r = buyIngredient(c, ing, q);
      if (r.ok) {
        steps.push({ k: 'ingredient', id: ing, name: INGREDIENTS[ing].name, qty: q });
        c = r.campaign;
        break;
      }
    }
  }
  for (const id of ['copo', 'saquinho'] as const) {
    const qty = sug.consumables[id];
    for (let q = Math.ceil(qty / 10) * 10; q >= 10; q -= 10) {
      const r = buyConsumable(c, id, q);
      if (r.ok) {
        steps.push({ k: 'consumable', id, name: CONSUMABLES[id].name, qty: q });
        c = r.campaign;
        break;
      }
    }
  }
  return { steps, expected: c };
}

/** "Usar sugerida" + "Comprar tudo" (InventoryTab): tudo ou nada. Devolve null se alguma compra for recusada. */
function buySuggested(c: Campaign, sug: ReturnType<typeof suggestPurchase>): Campaign | null {
  let cur = c;
  for (const ing of Object.keys(INGREDIENTS)) {
    const n = sug.ingredients[ing] ?? 0;
    if (n <= 0) continue;
    const r = buyIngredient(cur, ing, n);
    if (!r.ok) return null;
    cur = r.campaign;
  }
  for (const id of ['copo', 'saquinho'] as const) {
    const n = sug.consumables[id];
    if (n <= 0) continue;
    const r = buyConsumable(cur, id, n);
    if (!r.ok) return null;
    cur = r.campaign;
  }
  return cur;
}
