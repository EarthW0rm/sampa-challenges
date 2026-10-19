import type { TrackId } from './data';

const key = (track: TrackId) => `corredor-sp:recorde:${track}`;

export function loadRecord(track: TrackId): number {
  try {
    const v = Number(localStorage.getItem(key(track)));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveRecord(track: TrackId, points: number) {
  try {
    localStorage.setItem(key(track), String(points));
  } catch {
    /* armazenamento bloqueado: sem recorde */
  }
}

/** Maior recorde entre as pistas (para o card do hub). */
export function bestRecord(): number {
  return Math.max(loadRecord('23-de-maio'), loadRecord('radial-leste'), loadRecord('nacoes-unidas'));
}
