/**
 * Fábrica de campanhas salvas para os testes. Usa as próprias ações da campanha (código do jogo,
 * TypeScript puro) para montar um save válido e o injeta no `localStorage` antes do jogo carregar.
 */
import { buyConsumable, buyIngredient } from '../../../src/games/pastel-de-feira/game/campaign/actions/inventory';
import { newCampaign } from '../../../src/games/pastel-de-feira/game/campaign/campaign';
import { CURRENT_VERSION, SAVE_KEY, type SavePhase } from '../../../src/games/pastel-de-feira/game/campaign/save';
import type { Campaign, NewCampaignOptions } from '../../../src/games/pastel-de-feira/game/campaign/types';
import type { ConsumableId, IngredientId } from '../../../src/games/pastel-de-feira/game/data/catalog';

export { SAVE_KEY };

/** Semente fixa: o mesmo save gera sempre o mesmo dia (clientes, pedidos, eventos). */
export const SEED = 20261024;

/** Estoque padrão do dia 1: dá para o dia inteiro de Carne, Queijo e Caldo puro. */
export const STOCK_DIA1: Partial<Record<IngredientId, number>> = { massa: 40, carne: 20, mucarela: 20, oregano: 10, cana: 20 };
export const CONSUMIVEIS_DIA1: Partial<Record<ConsumableId, number>> = { copo: 30, saquinho: 50 };

export interface CampaignSpec {
  options?: Partial<Omit<NewCampaignOptions, 'seed'>>;
  seed?: number;
  stock?: Partial<Record<IngredientId, number>>;
  consumables?: Partial<Record<ConsumableId, number>>;
  /** Ajustes finais (ex.: dia, caixa, preços). Aplicados depois das compras. */
  patch?: (c: Campaign) => Campaign;
}

/** Monta uma campanha nova, compra o estoque pelas ações do jogo e aplica o patch. */
export function buildCampaign(spec: CampaignSpec = {}): Campaign {
  let c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, ...spec.options, seed: spec.seed ?? SEED });
  for (const [ing, qty] of Object.entries(spec.stock ?? STOCK_DIA1)) {
    const r = buyIngredient(c, ing as IngredientId, qty!);
    if (!r.ok) throw new Error(`fixture: compra de ${ing} recusada (${r.motivo})`);
    c = r.campaign;
  }
  for (const [id, qty] of Object.entries(spec.consumables ?? CONSUMIVEIS_DIA1)) {
    const r = buyConsumable(c, id as ConsumableId, qty!);
    if (!r.ok) throw new Error(`fixture: compra de ${id} recusada (${r.motivo})`);
    c = r.campaign;
  }
  return spec.patch ? spec.patch(c) : c;
}

/** Texto do save, como o jogo grava (`save.ts`). */
export function saveText(c: Campaign, phase: SavePhase = 'preparo'): string {
  return JSON.stringify({ version: CURRENT_VERSION, phase, campaign: c });
}
