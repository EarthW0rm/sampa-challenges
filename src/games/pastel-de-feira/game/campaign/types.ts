import type { ConsumableId, IngredientId } from '../data/catalog';
import type { ItemId } from '../data/recipes';
import type { TachoConfig } from '../types';

/** Estado da campanha entre os dias (plan.md 3.3). Só dados serializáveis em JSON. */

export type PastryProfile = 'tradicional' | 'negociante' | 'chapeiro' | 'boa-praca' | 'gestor';
export const PASTRY_PROFILES: readonly PastryProfile[] = ['tradicional', 'negociante', 'chapeiro', 'boa-praca', 'gestor'];

export type Theme = 'popular' | 'tradicional' | 'gourmet';

/** Lote de insumo no estoque da barraca. */
export interface InvLot {
  ingredient: IngredientId;
  qty: number;
  /** Custo unitário pago (R$), para o custo do que foi usado ou estragou. */
  unitCost: number;
  /** Último dia do calendário em que o lote ainda vale. Estraga no fechamento desse dia. */
  expires: number;
  /** Já passou uma noite na caixa térmica (não renova de novo). */
  inCooler: boolean;
}

export interface Owned {
  /** Receitas, versões e bebidas compradas. */
  items: ItemId[];
  /** Vagas do cardápio (RN-30b). */
  slotsSalgado: number;
  slotsDoce: number;
  tachos: TachoConfig[];
  /** Caixas térmicas compradas (RN-39). */
  coolers: number;
  /** Dinheiro gasto em equipamentos, espaço, mesas e estruturas (base do valor do ponto, RN-57). */
  spent: number;
}

export interface MenuChoice {
  salgados: ItemId[];
  doces: ItemId[];
  bebidas: ItemId[];
}

export interface DayHistory {
  day: number;
  calendar: number;
  revenue: number;
  profit: number;
  reputation: number;
  met: boolean;
  served: number;
  lost: number;
  wasteUnits: number;
}

export interface Campaign {
  /** Semente da campanha; a do dia sai de `hash(seed, calendar, resumes)`. */
  seed: number;
  /** Dia da campanha (contador de metas). Não avança quando a meta falha (RN-50). */
  day: number;
  /** Dias de feira já realizados (sempre avança). Valida a massa e varia a semente. */
  calendar: number;
  freeMode: boolean;
  cash: number;
  reputation: number;
  profile: PastryProfile;
  theme: Theme | null;
  eventsOn: boolean;
  tutorial: boolean;
  inventory: InvLot[];
  consumables: Record<ConsumableId, number>;
  owned: Owned;
  menu: MenuChoice;
  prices: Record<ItemId, number>;
  /** Dias seguidos no cardápio por receita base (RN-30c). */
  fatigue: Record<string, number>;
  /** Unidades de insumo compradas no Preparo de hoje (base do % de desperdício, RN-37). */
  boughtToday: number;
  /** Quantas vezes o dia foi retomado pelo checkpoint (muda a semente, PA-13). */
  resumes: number;
  history: DayHistory[];
}

/** Motivos fixos de recusa de uma ação do Preparo (plan.md 4.3). */
export type Refusal = 'semCaixa' | 'semCapacidade' | 'limite' | 'bloqueadoAteDia' | 'requer' | 'semEspaco';

export type ActionResult = { ok: true; campaign: Campaign } | { ok: false; motivo: Refusal };

export const REFUSAL_TEXT: Readonly<Record<Refusal, string>> = {
  semCaixa: 'Caixa insuficiente',
  semCapacidade: 'Sem espaço no estoque',
  limite: 'Limite atingido',
  bloqueadoAteDia: 'Ainda não disponível',
  requer: 'Falta um requisito',
  semEspaco: 'Sem espaço na barraca',
};

export interface NewCampaignOptions {
  profile: PastryProfile;
  eventsOn: boolean;
  tutorial: boolean;
  seed: number;
}

/** Linha do balanço do dia (tela de Fechamento). */
export interface BalanceLine {
  id: string;
  label: string;
  /** Positivo entra no lucro, negativo sai. */
  amount: number;
}

export interface Balance {
  lines: BalanceLine[];
  profit: number;
  goal: number | null;
  minReputation: number | null;
  profitMet: boolean;
  reputationMet: boolean;
  met: boolean;
  reputationBefore: number;
  reputationAfter: number;
  /** Unidades estragadas no fechamento (recheios, cana, complementos e massa vencida). */
  spoiledUnits: number;
  burnedUnits: number;
  leftoverUnits: number;
  wastePercent: number;
  bonus: number;
  bankrupt: boolean;
  newDay: number;
  freeModeStarted: boolean;
}
