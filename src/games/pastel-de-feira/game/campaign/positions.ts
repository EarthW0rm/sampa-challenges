import type { PositionId } from '../data/staff';
import type { Campaign } from './types';

/** Posições que existem na barraca agora (RN-40, RN-48). O número de funcionários não passa disto. */
export function positionsAvailable(c: Campaign): PositionId[] {
  const list: PositionId[] = ['balcao'];
  const n = c.owned.tachos.length;
  for (let i = 1; i <= n; i++) list.push(`montagem${i}` as PositionId);
  for (let i = 1; i <= n; i++) list.push(`fritador${i}` as PositionId);
  list.push('trocador', 'moenda');
  if (c.owned.tables > 0) list.push('garcom', 'ajudante');
  if (c.owned.delivery) list.push('expedicao');
  return list;
}
