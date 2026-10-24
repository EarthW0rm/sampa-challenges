import { DAY_TICKS } from '../game/constants';
import { devConfig } from './testConfig';
import { DaySim } from '../game/sim/day';
import type { Command, DayConfig } from '../game/types';

/** Utilitários dos cenários: assertivas com mensagem legível. Roda em node; não entra no bundle do jogo. */

export interface Scenario {
  id: string;
  /** Verificação de uma regra (ou grupo de regras) da spec. Lança Error se falhar. */
  run: (seed: number) => void;
  /** Regras cobertas, só para o relatório. */
  rules?: string;
}

export class CheckError extends Error {}

export function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new CheckError(msg);
}

export function checkEq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) throw new CheckError(`${msg}: esperado ${String(expected)}, obtido ${String(actual)}`);
}

/** Igualdade com tolerância para números de ponto flutuante. */
export function checkNear(actual: number, expected: number, msg: string, eps = 1e-6): void {
  if (!(Math.abs(actual - expected) <= eps)) {
    throw new CheckError(`${msg}: esperado ${expected} (±${eps}), obtido ${actual}`);
  }
}

export interface Scheduled {
  /** Passo (0 = antes do primeiro passo) em que o comando é enviado. */
  tick: number;
  cmd: Command;
}

/** Cria o simulador com a config de teste (ou outra) e a semente. */
export function makeSim(seed: number, config: DayConfig = devConfig()): DaySim {
  return new DaySim(config, seed);
}

/** Avança `ticks` passos enviando os comandos agendados no passo certo. Devolve o simulador. */
export function advance(sim: DaySim, ticks: number, schedule: readonly Scheduled[] = []): DaySim {
  for (let i = 0; i < ticks && !sim.isOver(); i++) {
    const at = sim.state.tick;
    for (const sc of schedule) if (sc.tick === at) sim.dispatch(sc.cmd);
    sim.step();
  }
  return sim;
}

/** Roda o dia inteiro. */
export function runDay(seed: number, config: DayConfig = devConfig(), schedule: readonly Scheduled[] = []): DaySim {
  const sim = makeSim(seed, config);
  advance(sim, DAY_TICKS + 5, schedule);
  return sim;
}

/** Hash FNV-1a de qualquer valor serializável em JSON (comparar `DayResult` entre execuções). */
export function hashOf(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
