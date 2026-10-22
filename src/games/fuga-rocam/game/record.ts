import type { MapId } from './types';

const key = (m: MapId) => `fuga-rocam:recorde:${m}`;

export function loadRecord(m: MapId): number {
  try {
    const v = Number(localStorage.getItem(key(m)));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveRecord(m: MapId, score: number) {
  try {
    localStorage.setItem(key(m), String(score));
  } catch {
    /* navegação privada ou armazenamento bloqueado: sem recorde */
  }
}

/** Melhor recorde entre os mapas (para o card do hub). */
export function bestRecord(): number {
  return Math.max(loadRecord('centro'), loadRecord('paulista'), loadRecord('marginal'));
}
