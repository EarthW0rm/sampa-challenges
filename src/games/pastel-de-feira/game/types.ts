import type { ConsumableId, IngredientId } from './data/catalog';
import type { ItemId } from './data/recipes';

/** Tipos compartilhados entre simulação, campanha e apresentação (plan.md 3.2). */

export type Profile = 'economico' | 'padrao' | 'exigente';

export type StationId =
  | 'balcao'
  | 'bancada'
  | 'tacho1'
  | 'tacho2'
  | 'tacho3'
  | 'estufa'
  | 'moenda'
  | 'mesas'
  | 'expedicao'
  | 'escritorio'
  | 'descanso';

export type HoldAction = 'moenda' | 'oleo' | 'limpar';

/** Alvo de um toque dentro do painel de uma estação. */
export type Slot =
  | { k: 'anotar' }
  | { k: 'moedas' }
  | { k: 'ingrediente'; id: IngredientId }
  | { k: 'fechar' }
  | { k: 'limpar' }
  | { k: 'montado'; id: number }
  | { k: 'cesto'; index: number }
  | { k: 'pronto'; id: number };

/** Item pronto que pode ser entregue a um cliente. */
export type ItemRef = { kind: 'pastel' | 'copo'; id: number };

/**
 * A única entrada do jogador na simulação. `g` é o id do gesto: o mesmo id é processado uma vez
 * só (toque duplo não cobra nem entrega em dobro).
 */
export type Command =
  | { type: 'tapStation'; station: StationId; g?: number }
  | { type: 'tapSlot'; station: StationId; slot: Slot; g?: number }
  | { type: 'holdStart'; station: StationId; action: HoldAction; g?: number }
  | { type: 'holdEnd'; g?: number }
  | { type: 'deliver'; item: ItemRef; customerId: number; g?: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setSpeed'; speed: 1 | 2 };

/** Item do cardápio do dia com o preço de venda escolhido no Preparo (RN-10). */
export interface MenuEntry {
  item: ItemId;
  price: number;
}

/** Lote de insumo em estoque. `daysLeft` = dias de validade restantes (massa: até 3, RN-34). */
export interface StockLot {
  ingredient: IngredientId;
  qty: number;
  daysLeft: number;
}

export interface TachoConfig {
  baskets: number;
  oil: 'comum' | 'algodao';
}

/** Campanha → simulação. Imutável durante o dia. */
export interface DayConfig {
  day: number;
  /** Reputação inicial, de 1,0 a 5,0. */
  reputation: number;
  menu: MenuEntry[];
  stock: StockLot[];
  consumables: Record<ConsumableId, number>;
  /** Estações existentes, na ordem física usada para o deslocamento (RN-41). */
  stations: StationId[];
  tachos: TachoConfig[];
}
