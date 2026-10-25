import { DaySim } from '../game/sim/day';
import type { Command, DayConfig } from '../game/types';
import { hashOf } from './harness';

/** Formato do arquivo de replay (não versionado): config + semente + comandos por passo + hash do resultado. */
export interface Replay {
  versao: 1;
  config: DayConfig;
  seed: number;
  comandos: { passo: number; cmd: Command }[];
  hash: string;
}

export const REPLAY_VERSION = 1;

/** Grava o replay de um dia já jogado com `sim.startLog()` ligado desde o início. */
export function recordReplay(config: DayConfig, seed: number, sim: DaySim): Replay {
  const result = sim.result();
  if (!result) throw new Error('Replay exige o dia terminado');
  return { versao: REPLAY_VERSION, config, seed, comandos: sim.commandLog().map((c) => ({ passo: c.passo, cmd: c.cmd })), hash: hashOf(result) };
}

/** Valida a forma do arquivo; recusa versões antigas com mensagem clara (sem falso positivo). */
export function parseReplay(raw: unknown): Replay {
  const r = raw as Partial<Replay> | null;
  if (!r || typeof r !== 'object') throw new Error('Replay inválido: não é um objeto');
  if (r.versao !== REPLAY_VERSION) throw new Error(`Replay de versão ${String(r.versao)}: esta versão do jogo lê só a ${REPLAY_VERSION}`);
  if (!r.config || typeof r.seed !== 'number' || !Array.isArray(r.comandos) || typeof r.hash !== 'string') throw new Error('Replay inválido: campos ausentes');
  return r as Replay;
}

/** Reexecuta o dia com os mesmos comandos nos mesmos passos e devolve o hash do resultado. */
export function runReplay(r: Replay): string {
  const sim = new DaySim(r.config, r.seed);
  const list = [...r.comandos].sort((a, b) => a.passo - b.passo);
  let k = 0;
  for (let step = 0; !sim.isOver() && step < 100000; step++) {
    while (k < list.length && list[k].passo <= step) sim.dispatch(list[k++].cmd);
    sim.step();
  }
  const result = sim.result();
  if (!result) throw new Error('Replay não terminou o dia');
  return hashOf(result);
}
