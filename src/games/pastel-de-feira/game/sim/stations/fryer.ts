import {
  HOLD_OIL_MANUAL, OIL_CHANGE_COST, OIL_CHANGE_COST_COTTON, OIL_DIRTY_QUALITY_PENALTY, OIL_DIRTY_THRESHOLD,
  OIL_DIRT_PER_PASTRY, OIL_DIRT_PER_PASTRY_COTTON, OIL_LOCK_PERCENT, QUALITY_OVERDONE, QUALITY_PONTO, QUALITY_RAW,
  STEP,
} from '../../constants';
import { ITEMS, type Item } from '../../data/recipes';
import { swapDemand } from '../customers';
import { isAt } from '../pasteleiro';
import { emit, now, type DayState, type Tacho } from '../state';

const EPS = 1e-9;

export type FryOutcome = 'cru' | 'ponto' | 'passado' | 'queimado';

/** Desfecho de um pastel tirado do óleo aos `seconds` de fritura (RN-23). */
export function fryOutcome(item: Item, seconds: number): FryOutcome {
  if (seconds >= item.burnAt - EPS) return 'queimado';
  if (seconds < item.ponto[0] - EPS) return 'cru';
  if (seconds <= item.ponto[1] + EPS) return 'ponto';
  return 'passado';
}

const tachoIndex = (station: string): number => Number(station.slice('tacho'.length)) - 1;

export const isLocked = (t: Tacho): boolean => t.dirt >= OIL_LOCK_PERCENT - EPS;
export const isDirty = (t: Tacho): boolean => t.dirt >= OIL_DIRTY_THRESHOLD - EPS;
export const isChanging = (t: Tacho): boolean => t.changeProgress > 0;

/**
 * Modificadores de nota na saída do óleo (RN-24). Ponto de extensão: equipamentos (US-112),
 * traços e cursos (US-113) somam aqui.
 */
export function qualityModifiers(_s: DayState, tacho: Tacho): number {
  return isDirty(tacho) ? -OIL_DIRTY_QUALITY_PENALTY : 0;
}

/** Nota na saída do óleo por desfecho (RN-23), com modificadores, limitada a 0–100. */
export function outcomeQuality(s: DayState, tacho: Tacho, outcome: FryOutcome): number {
  const base = outcome === 'cru' ? QUALITY_RAW : outcome === 'ponto' ? QUALITY_PONTO : QUALITY_OVERDONE;
  return Math.max(0, Math.min(100, base + qualityModifiers(s, tacho)));
}

/** Colocar o pastel montado num cesto livre (RN-42). */
function place(s: DayState, tacho: Tacho, index: number): boolean {
  const basket = tacho.baskets[index];
  if (!basket || basket.frying || isLocked(tacho) || isChanging(tacho)) return false;
  const pick =
    s.assembled.find((a) => a.id === s.selectedAssembled) ?? s.assembled[0];
  if (!pick) return false;
  s.assembled.splice(s.assembled.indexOf(pick), 1);
  s.selectedAssembled = null;
  basket.frying = { id: pick.id, item: pick.item, ticks: 0, burned: false };
  const perPastry = tacho.oil === 'algodao' ? OIL_DIRT_PER_PASTRY_COTTON : OIL_DIRT_PER_PASTRY;
  tacho.dirt = Math.min(1, Math.round((tacho.dirt + perPastry) * 1e6) / 1e6);
  emit(s, 'colocou', pick.id);
  return true;
}

/** Tirar do óleo: o desfecho depende do tempo de fritura (RN-23). Queimado vira desperdício e libera o cesto. */
function take(s: DayState, tacho: Tacho, index: number): boolean {
  const basket = tacho.baskets[index];
  const f = basket?.frying;
  if (!f) return false;
  basket.frying = null;
  if (f.burned) {
    s.stats.burned++;
    emit(s, 'descartou', f.id);
    swapDemand(s);
    return true;
  }
  const outcome = fryOutcome(ITEMS[f.item], f.ticks * STEP);
  s.ready.push({ id: f.id, item: f.item, quality: outcomeQuality(s, tacho, outcome), readyAt: now(s) });
  emit(s, outcome === 'ponto' ? 'tirou_no_ponto' : outcome === 'cru' ? 'tirou_cru' : 'tirou_passado', f.id);
  return true;
}

/** Toque num cesto: coloca se estiver livre, tira se estiver ocupado. */
export function tapBasket(s: DayState, station: string, index: number): boolean {
  if (!isAt(s, station as 'tacho1')) return false;
  const tacho = s.tachos[tachoIndex(station)];
  if (!tacho) return false;
  return tacho.baskets[index]?.frying ? take(s, tacho, index) : place(s, tacho, index);
}

/** Começa a trocar o óleo, segurando o tacho (RN-42). */
export function startOilChange(s: DayState, station: string): boolean {
  const tacho = s.tachos[tachoIndex(station)];
  if (!tacho || !isAt(s, station as 'tacho1')) return false;
  s.pasteleiro.hold = { action: 'oleo', station: station as 'tacho1' };
  tacho.changeProgress = EPS;
  return true;
}

/** Soltar antes do fim cancela sem custo. */
export function cancelOilChange(s: DayState): void {
  for (const t of s.tachos) t.changeProgress = 0;
}

function finishOilChange(s: DayState, tacho: Tacho): void {
  const cost = tacho.oil === 'algodao' ? OIL_CHANGE_COST_COTTON : OIL_CHANGE_COST;
  tacho.dirt = 0;
  tacho.changeProgress = 0;
  s.stats.oilCost = Math.round((s.stats.oilCost + cost) * 100) / 100;
  s.pasteleiro.hold = null;
  emit(s, 'oleo_trocado');
}

/** Avança a fritura (parada durante a troca) e o progresso da troca. */
export function updateFryers(s: DayState, dt: number): void {
  for (const tacho of s.tachos) {
    if (isChanging(tacho)) {
      tacho.changeProgress += dt;
      if (tacho.changeProgress >= HOLD_OIL_MANUAL - EPS) finishOilChange(s, tacho);
      continue; // tacho parado durante a troca
    }
    for (const b of tacho.baskets) {
      const f = b.frying;
      if (!f || f.burned) continue;
      f.ticks++;
      if (f.ticks * STEP >= ITEMS[f.item].burnAt - EPS) {
        f.burned = true;
        emit(s, 'queimou', f.id);
      }
    }
  }
}
