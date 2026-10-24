import type { ConsumableId, IngredientId } from '../data/catalog';
import type { ItemId } from '../data/recipes';
import { Rng } from '../rng';
import type { Command, DayConfig, HoldAction, Profile, SimEvent, StationId, StockLot } from '../types';

export interface OrderLine {
  /** Item desejado. Muda só na troca automática (RN-35). */
  item: ItemId;
  /** Item entregue, quando já foi. */
  delivered: ItemId | null;
}

export interface Customer {
  id: number;
  profile: Profile;
  /** Teto de preço como fração da referência (perfil + reputação, RN-11/14). */
  ceiling: number;
  patience: number;
  patienceMax: number;
  lines: OrderLine[];
  /** `aguardando`: ainda não anotado. `anotado`: espera o pedido (RN-42). */
  state: 'aguardando' | 'anotado';
  arrivedAt: number;
  /** Já recebeu um item errado (RN-63). */
  wrong: boolean;
  /** A falha do pedido já foi registrada: cada pedido termina uma vez só (RN-61, RN-63). */
  failed: boolean;
  /** Algum item foi entregue abaixo da exigência de qualidade (RN-15). */
  lowQuality: boolean;
  /** Valor acumulado dos itens entregues (vira moeda no balcão quando o pedido fecha). */
  owed: number;
}

export interface Coin {
  id: number;
  amount: number;
}

/** Pastel montado na bancada, ainda sem fritar. */
export interface Assembled {
  id: number;
  item: ItemId;
}

/** Pastel dentro de um cesto do tacho. */
export interface Frying {
  id: number;
  item: ItemId;
  /** Passos de fritura (inteiro: o ponto e a queima não acumulam erro de ponto flutuante). */
  ticks: number;
  burned: boolean;
  /** Alarmes já disparados (uma vez por pastel). */
  pontoAlerted: boolean;
  burnAlerted: boolean;
}

export interface Basket {
  frying: Frying | null;
  /** Índice do cesto principal quando este cesto está ocupado pelo outro lado de um pastel grande (RN-30d). */
  shadow: number | null;
}

export interface Tacho {
  baskets: Basket[];
  oil: 'comum' | 'algodao';
  /** Sujeira do óleo, de 0 a 1 (RN-46). */
  dirt: number;
  /** Troca de óleo em andamento: progresso em segundos de 0 a HOLD_OIL_MANUAL. */
  changeProgress: number;
  thermostat: boolean;
  alarm: boolean;
  timer: boolean;
}

/** Pastel pronto, esperando entrega. A nota decai com o tempo (RN-25). */
export interface Ready {
  id: number;
  item: ItemId;
  /** Nota na saída do óleo, já com modificadores. */
  quality: number;
  readyAt: number;
  /** Está na estufa: a nota fica congelada por 60 s (RN-27). */
  warmed?: boolean;
}

export interface Cup {
  id: number;
  item: ItemId;
}

export interface Pasteleiro {
  at: StationId;
  /** Destino em deslocamento, ou null. */
  to: StationId | null;
  moveLeft: number;
  /** Duração do deslocamento em curso (para animar a posição). */
  moveTotal: number;
  hold: { action: HoldAction; station: StationId; item?: ItemId } | null;
}

export interface Reputation {
  successes: number;
  charm: number;
  /** Soma dos pesos das falhas (RN-61). */
  failures: number;
}

export interface Stats {
  arrived: number;
  served: number;
  lostPatience: number;
  wrong: number;
  queueFull: number;
  lostPrice: number;
  noStock: number;
  burned: number;
  revenue: number;
  oilCost: number;
}

/** Estado mutável do Dia de Feira. Os arrays nunca são reatribuídos (o snapshot guarda referências). */
export interface DayState {
  config: DayConfig;
  seed: number;
  /** Passos executados. O tempo é `tick * STEP`. */
  tick: number;
  over: boolean;
  paused: boolean;
  speed: 1 | 2;
  rng: { customers: Rng; quality: Rng };
  nextId: number;
  commands: Command[];
  seenGestures: Set<number>;
  rejected: number;
  events: SimEvent[];
  stock: StockLot[];
  consumables: Record<ConsumableId, number>;
  customers: Customer[];
  arrivalLeft: number;
  coins: Coin[];
  /** Ingredientes clicados na bancada, ainda sem "fechar". */
  tray: IngredientId[];
  assembled: Assembled[];
  selectedAssembled: number | null;
  tachos: Tacho[];
  ready: Ready[];
  cups: Cup[];
  mill: { progress: number; item: ItemId | null };
  pasteleiro: Pasteleiro;
  rep: Reputation;
  stats: Stats;
}

export function createState(config: DayConfig, seed: number): DayState {
  const root = new Rng(seed);
  const rng = { customers: root.fork('clientes'), quality: root.fork('qualidade') };
  return {
    config,
    seed: root.seed,
    tick: 0,
    over: false,
    paused: false,
    speed: 1,
    rng,
    nextId: 1,
    commands: [],
    seenGestures: new Set(),
    rejected: 0,
    events: [],
    stock: config.stock.map((l) => ({ ...l })),
    consumables: { ...config.consumables },
    customers: [],
    arrivalLeft: 1 + rng.customers.next() * 3,
    coins: [],
    tray: [],
    assembled: [],
    selectedAssembled: null,
    tachos: config.tachos.map((t) => ({
      baskets: Array.from({ length: t.baskets }, () => ({ frying: null, shadow: null })),
      oil: t.oil,
      dirt: 0,
      changeProgress: 0,
      thermostat: t.thermostat,
      alarm: t.alarm,
      timer: t.timer,
    })),
    ready: [],
    cups: [],
    mill: { progress: 0, item: null },
    pasteleiro: { at: config.stations[0], to: null, moveLeft: 0, moveTotal: 0, hold: null },
    rep: { successes: 0, charm: 0, failures: 0 },
    stats: {
      arrived: 0, served: 0, lostPatience: 0, wrong: 0, queueFull: 0, lostPrice: 0, noStock: 0,
      burned: 0, revenue: 0, oilCost: 0,
    },
  };
}

export const now = (s: DayState): number => s.tick / 60;

export const newId = (s: DayState): number => s.nextId++;

export function emit(s: DayState, type: SimEvent['type'], id?: number): void {
  s.events.push({ type, t: now(s), id });
}
