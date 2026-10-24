import { BROOM_POINTS, DIRT_MAX, HOLD_BROOM, HOLD_CLEAN_TABLE } from '../constants';
import { emit, type DayState } from './state';
import { isAt } from './pasteleiro';

/** Soma (ou tira, com valor negativo) sujeira da barraca, de 0 a 100 (RN-130, RN-131). */
export function addDirt(s: DayState, points: number): void {
  s.dirt = Math.max(0, Math.min(DIRT_MAX, s.dirt + points));
}

/** Primeira mesa com algum lugar sujo, ou -1 (RN-84). */
export function dirtyTable(s: DayState): number {
  return s.tables.findIndex((t) => t.seats.includes('sujo'));
}

/** Limpar uma mesa limpa todos os lugares dela (RN-84). */
export function cleanTable(s: DayState, index: number): void {
  const t = s.tables[index];
  if (!t) return;
  t.seats = t.seats.map((x) => (x === 'sujo' ? 'livre' : x));
  emit(s, 'mesa_limpa');
}

/**
 * O pasteleiro segura a mesa (3 s, limpa a mesa) ou a vassoura (4 s, tira 25 de sujeira) (RN-42, RN-132).
 * Nas mesas ele limpa a mesa suja; em qualquer outra estação, a barraca.
 */
export function startCleaning(s: DayState, station: string): boolean {
  if (!isAt(s, station as 'balcao')) return false;
  if (station === 'mesas') {
    const table = dirtyTable(s);
    if (table < 0) return false;
    s.cleaning = { progress: 0, table };
  } else {
    if (s.dirt <= 0) return false;
    s.cleaning = { progress: 0, table: null };
  }
  s.pasteleiro.hold = { action: 'limpar', station: station as 'balcao' };
  return true;
}

export function cancelCleaning(s: DayState): void {
  if (s.pasteleiro.hold?.action === 'limpar') s.pasteleiro.hold = null;
  s.cleaning = { progress: 0, table: null };
}

const EPS = 1e-9;

export function updateCleaning(s: DayState, dt: number): void {
  const hold = s.pasteleiro.hold;
  if (hold?.action !== 'limpar') return;
  s.cleaning.progress += dt;
  const needed = s.cleaning.table === null ? HOLD_BROOM : HOLD_CLEAN_TABLE;
  if (s.cleaning.progress < needed - EPS) return;
  if (s.cleaning.table === null) addDirt(s, -BROOM_POINTS);
  else cleanTable(s, s.cleaning.table);
  s.cleaning = { progress: 0, table: null };
  s.pasteleiro.hold = null;
}
