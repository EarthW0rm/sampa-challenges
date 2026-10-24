import { DAY_TICKS, STEP, hourAt } from '../constants';
import type { Command, DayConfig, DayResult, SimEvent } from '../types';
import { updateCustomers } from './customers';
import { createState, emit, type DayState } from './state';

/** Visão só de leitura do dia, reaproveitada entre quadros (os arrays são os do próprio estado). */
export interface DaySnapshot {
  /** Instante do dia em segundos. */
  t: number;
  /** Hora do relógio do jogo (7 a 14). */
  hour: number;
  over: boolean;
  paused: boolean;
  speed: 1 | 2;
  rejected: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Type guard da borda: só aceita comandos com a forma esperada. */
function isCommand(v: unknown): v is Command {
  if (!isObject(v) || typeof v.type !== 'string') return false;
  switch (v.type) {
    case 'pause':
    case 'resume':
    case 'holdEnd':
      return true;
    case 'setSpeed':
      return v.speed === 1 || v.speed === 2;
    case 'tapStation':
      return typeof v.station === 'string';
    case 'tapSlot':
      return typeof v.station === 'string' && isObject(v.slot) && typeof v.slot.k === 'string';
    case 'holdStart':
      return typeof v.station === 'string' && typeof v.action === 'string';
    case 'deliver':
      return isObject(v.item) && typeof v.item.id === 'number' && typeof v.customerId === 'number';
    default:
      return false;
  }
}

/**
 * Motor do Dia de Feira: determinístico, passo fixo (1/60 s) e semente. Mesma `config` + mesma
 * `seed` + mesma sequência de comandos por passo = mesmo `DayResult`.
 */
export class DaySim {
  readonly state: DayState;
  private readonly view: DaySnapshot;
  private cached: DayResult | null = null;

  constructor(config: DayConfig, seed: number) {
    this.state = createState(config, seed);
    this.view = { t: 0, hour: hourAt(0), over: false, paused: false, speed: 1, rejected: 0 };
  }

  /** Comandos de sessão valem na hora; os demais entram na fila e são aplicados no próximo passo. */
  dispatch(cmd: Command): void {
    const s = this.state;
    if (!isCommand(cmd)) {
      s.rejected++;
      return;
    }
    switch (cmd.type) {
      case 'pause':
        s.paused = true;
        break;
      case 'resume':
        s.paused = false;
        break;
      case 'setSpeed':
        s.speed = cmd.speed;
        break;
      default:
        if (!s.over) s.commands.push(cmd);
    }
  }

  step(dt: number = STEP): void {
    if (Math.abs(dt - STEP) > 1e-9) throw new Error(`DaySim.step exige dt = ${STEP}, recebeu ${dt}`);
    const s = this.state;
    if (s.over || s.paused) return;
    this.applyCommands();
    s.tick++;
    updateCustomers(s, STEP);
    if (s.tick >= DAY_TICKS) this.close();
  }

  snapshot(): DaySnapshot {
    const s = this.state;
    const v = this.view;
    v.t = s.tick * STEP;
    v.hour = hourAt(v.t);
    v.over = s.over;
    v.paused = s.paused;
    v.speed = s.speed;
    v.rejected = s.rejected;
    return v;
  }

  /** Disponível depois do corte seco (RN-07). */
  result(): DayResult | null {
    return this.cached;
  }

  isOver(): boolean {
    return this.state.over;
  }

  /** Entrega e limpa os eventos acumulados desde a última chamada (som, partículas). */
  drainEvents(): SimEvent[] {
    const out = this.state.events.slice();
    this.state.events.length = 0;
    return out;
  }

  private applyCommands(): void {
    const s = this.state;
    const list = s.commands;
    for (let i = 0; i < list.length; i++) {
      const cmd = list[i];
      if ('g' in cmd && cmd.g !== undefined) {
        if (s.seenGestures.has(cmd.g)) continue;
        s.seenGestures.add(cmd.g);
      }
      s.rejected++; // nenhum comando de estação existe ainda; as TFs seguintes tratam cada um
    }
    list.length = 0;
  }

  /** Corte seco às 14h (RN-07): tudo o que está em aberto se perde, sem falha. */
  private close(): void {
    const s = this.state;
    s.over = true;
    s.customers.length = 0; // quem estava na fila vai embora sem pagar e sem falha
    emit(s, 'corte_seco');
    this.cached = {
      day: s.config.day,
      ticks: s.tick,
      revenue: { counter: 0, total: 0 },
      costs: { oil: 0 },
      orders: {
        served: s.stats.served,
        lostPatience: s.stats.lostPatience,
        wrong: s.stats.wrong,
        queueFull: s.stats.queueFull,
        lostPrice: s.stats.lostPrice,
        noStock: s.stats.noStock,
      },
      waste: { burned: 0, leftover: 0 },
      reputation: { successes: 0, charm: 0, weightedFailures: 0, rate: 0, change: 0 },
      stockLeft: s.stock.map((l) => ({ ...l })),
      consumables: { ...s.consumables },
    };
  }
}
