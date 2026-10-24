import { MOVE_EXTRA_STATION, MOVE_NEIGHBOR } from '../constants';
import type { StationId } from '../types';
import type { DayState } from './state';

/** Tempo de deslocamento em segundos para `hops` estações de distância (RN-41). */
export const moveTime = (hops: number): number => MOVE_NEIGHBOR + MOVE_EXTRA_STATION * (hops - 1);

/** Distância em estações entre duas posições na ordem física da barraca. */
export function hopsBetween(s: DayState, a: StationId, b: StationId): number {
  const list = s.config.stations;
  return Math.abs(list.indexOf(a) - list.indexOf(b));
}

/** O pasteleiro está parado nesta estação (só aí as ações valem)? */
export const isAt = (s: DayState, station: StationId): boolean => s.pasteleiro.to === null && s.pasteleiro.at === station;

/**
 * Toque numa estação: desloca o pasteleiro até lá. O último clique substitui o destino, sem enfileirar (spec 4).
 * Durante o deslocamento a origem continua sendo a estação de partida.
 */
export function tapStation(s: DayState, station: StationId): boolean {
  if (!s.config.stations.includes(station)) return false;
  const p = s.pasteleiro;
  if (p.hold?.action === 'oleo') {
    for (const t of s.tachos) {
      if (t.changeBy === -1) {
        t.changeProgress = 0; // sair da estação cancela a troca
        t.changeBy = 0;
      }
    }
  }
  p.hold = null;
  if (station === p.at) {
    p.to = null;
    p.moveLeft = 0;
    p.moveTotal = 0;
    return true;
  }
  p.to = station;
  p.moveTotal = moveTime(hopsBetween(s, p.at, station));
  p.moveLeft = p.moveTotal;
  return true;
}

export function updatePasteleiro(s: DayState, dt: number): void {
  const p = s.pasteleiro;
  if (p.to === null) return;
  p.moveLeft -= dt;
  if (p.moveLeft <= 1e-9) {
    p.at = p.to;
    p.to = null;
    p.moveLeft = 0;
    p.moveTotal = 0;
  }
}
