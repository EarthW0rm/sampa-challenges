import type { ConsumableId } from '../data/catalog';
import { Rng } from '../rng';
import type { Command, DayConfig, SimEvent, StockLot } from '../types';

/** Estado mutável do Dia de Feira. Os arrays nunca são reatribuídos (o snapshot guarda referências). */
export interface DayState {
  config: DayConfig;
  seed: number;
  /** Passos executados. O tempo é `tick * STEP`. */
  tick: number;
  over: boolean;
  paused: boolean;
  speed: 1 | 2;
  rng: { customers: Rng };
  nextId: number;
  commands: Command[];
  seenGestures: Set<number>;
  rejected: number;
  events: SimEvent[];
  stock: StockLot[];
  consumables: Record<ConsumableId, number>;
}

export function createState(config: DayConfig, seed: number): DayState {
  const root = new Rng(seed);
  return {
    config,
    seed: root.seed,
    tick: 0,
    over: false,
    paused: false,
    speed: 1,
    rng: { customers: root.fork('clientes') },
    nextId: 1,
    commands: [],
    seenGestures: new Set(),
    rejected: 0,
    events: [],
    stock: config.stock.map((l) => ({ ...l })),
    consumables: { ...config.consumables },
  };
}

export const newId = (s: DayState): number => s.nextId++;

export function emit(s: DayState, type: SimEvent['type'], id?: number): void {
  s.events.push({ type, t: s.tick / 60, id });
}
