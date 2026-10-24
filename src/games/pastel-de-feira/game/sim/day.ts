import { DAY_TICKS, STEP, hourAt } from '../constants';
import type { Command, DayConfig, DayResult, SimEvent } from '../types';
import { applyCommand } from './commands';
import { updateCleaning } from './dirt';
import { updateDelivery } from './delivery';
import { updateOrders } from './orders';
import { planWorld, updateWorld } from './world';
import { updateCustomers } from './customers';
import { updatePasteleiro } from './pasteleiro';
import { buildResult } from './result';
import { updateMill } from './stations/cane';
import { updateStaff } from './staff';
import { updateTables } from './stations/tables';
import { updateFryers } from './stations/fryer';
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
    case 'sendRest':
      return typeof v.staffId === 'number';
    case 'acceptOffer':
      return typeof v.offerId === 'number';
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
    planWorld(this.state);
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
    updatePasteleiro(s, STEP);
    updateStaff(s, STEP);
    updateFryers(s, STEP);
    updateMill(s, STEP);
    updateCleaning(s, STEP);
    updateCustomers(s, STEP);
    updateTables(s, STEP);
    updateDelivery(s, STEP);
    updateOrders(s, STEP);
    updateWorld(s, STEP);
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
      if (!applyCommand(s, cmd)) s.rejected++;
    }
    list.length = 0;
  }

  /** Corte seco às 14h (RN-07): tudo o que está em aberto se perde, sem falha. */
  private close(): void {
    const s = this.state;
    s.over = true;
    s.customers.length = 0; // quem estava na fila vai embora sem pagar e sem falha
    s.eating.length = 0; // grupos nas mesas e na fila de pagamento também (RN-07)
    s.payQueue.length = 0;
    s.bigOrders.length = 0; // encomenda pendente às 14h se perde sem multa nem falha (RN-07)
    s.offers.length = 0; // comandas e motoboys pendentes se perdem sem falha (RN-07)
    s.comandas.length = 0;
    s.motoboys.length = 0;
    emit(s, 'corte_seco');
    this.cached = buildResult(s);
  }
}
