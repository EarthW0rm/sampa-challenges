import {
  HOLD_OIL_MANUAL, OIL_CHANGE_COST, OIL_CHANGE_COST_COTTON, OIL_DIRTY_QUALITY_PENALTY, OIL_DIRTY_THRESHOLD,
  OIL_DIRT_PER_PASTRY, OIL_DIRT_PER_PASTRY_COTTON, OIL_LOCK_PERCENT, QUALITY_OVERDONE, QUALITY_PONTO, QUALITY_RAW,
  STEP,
} from '../../constants';
import { QUALITY_BONUS, THERMOSTAT } from '../../data/equipment';
import { ITEMS, type Item } from '../../data/recipes';
import { swapDemand } from '../customers';
import { isAt } from '../pasteleiro';
import { emit, now, type DayState, type Tacho } from '../state';

const EPS = 1e-9;

export type FryOutcome = 'cru' | 'ponto' | 'passado' | 'queimado';

export interface FryWindow {
  /** Janela do ponto [início, fim] em segundos de fritura. */
  ponto: readonly [number, number];
  /** Segundos até queimar. */
  burnAt: number;
}

/** Janela de fritura do item neste tacho. O termostato alarga o ponto em 50% e adia a queima em 3 s (RN-73). */
export function fryWindow(item: Item, tacho: Pick<Tacho, 'thermostat'>): FryWindow {
  if (!tacho.thermostat) return { ponto: item.ponto, burnAt: item.burnAt };
  const [a, b] = item.ponto;
  return { ponto: [a, a + (b - a) * THERMOSTAT.pontoMult], burnAt: item.burnAt + THERMOSTAT.burnExtra };
}

/** Desfecho de um pastel tirado do óleo aos `seconds` de fritura (RN-23). */
export function fryOutcome(win: FryWindow, seconds: number): FryOutcome {
  if (seconds >= win.burnAt - EPS) return 'queimado';
  if (seconds < win.ponto[0] - EPS) return 'cru';
  if (seconds <= win.ponto[1] + EPS) return 'ponto';
  return 'passado';
}

const tachoIndex = (station: string): number => Number(station.slice('tacho'.length)) - 1;

export const isLocked = (t: Tacho): boolean => t.dirt >= OIL_LOCK_PERCENT - EPS;
export const isDirty = (t: Tacho): boolean => t.dirt >= OIL_DIRTY_THRESHOLD - EPS;
export const isChanging = (t: Tacho): boolean => t.changeProgress > 0;

/**
 * Modificadores de nota na saída do óleo (RN-24): óleo sujo −15, óleo de algodão +10, escorredor +10.
 * Traços e cursos (US-113) somam aqui.
 */
export function qualityModifiers(s: DayState, tacho: Tacho): number {
  let m = 0;
  if (isDirty(tacho)) m -= OIL_DIRTY_QUALITY_PENALTY;
  if (tacho.oil === 'algodao') m += QUALITY_BONUS.cotton;
  if (s.config.equipment.drainer) m += QUALITY_BONUS.drainer;
  return m;
}

/** Nota na saída do óleo por desfecho (RN-23), com modificadores, limitada a 0–100. */
export function outcomeQuality(s: DayState, tacho: Tacho, outcome: FryOutcome): number {
  const base = outcome === 'cru' ? QUALITY_RAW : outcome === 'ponto' ? QUALITY_PONTO : QUALITY_OVERDONE;
  return Math.max(0, Math.min(100, base + qualityModifiers(s, tacho)));
}

const isFree = (t: Tacho, i: number): boolean => !t.baskets[i].frying && t.baskets[i].shadow === null;

/** Cesto parceiro de um pastel grande: o vizinho livre, senão qualquer livre (RN-30d). */
function partnerBasket(t: Tacho, index: number): number {
  for (const j of [index + 1, index - 1]) if (j >= 0 && j < t.baskets.length && isFree(t, j)) return j;
  for (let j = 0; j < t.baskets.length; j++) if (j !== index && isFree(t, j)) return j;
  return -1;
}

/** Colocar o pastel montado num cesto livre (RN-42). O Especial da Casa ocupa 2 cestos (RN-30d). */
export function placeBasket(s: DayState, tacho: Tacho, index: number): boolean {
  if (!tacho.baskets[index] || !isFree(tacho, index) || isLocked(tacho) || isChanging(tacho)) return false;
  const pick = s.assembled.find((a) => a.id === s.selectedAssembled) ?? s.assembled[0];
  if (!pick) return false;
  const big = ITEMS[pick.item].doughs > 1;
  const partner = big ? partnerBasket(tacho, index) : -1;
  if (big && partner < 0) return false; // sem 2 cestos livres: o jogador escolhe outro tacho
  s.assembled.splice(s.assembled.indexOf(pick), 1);
  s.selectedAssembled = null;
  tacho.baskets[index].frying = { id: pick.id, item: pick.item, ticks: 0, burned: false, pontoAlerted: false, burnAlerted: false, bonus: pick.bonus };
  if (big) tacho.baskets[partner].shadow = index;
  const perPastry = tacho.oil === 'algodao' ? OIL_DIRT_PER_PASTRY_COTTON : OIL_DIRT_PER_PASTRY;
  tacho.dirt = Math.min(1, Math.round((tacho.dirt + perPastry) * 1e6) / 1e6);
  emit(s, 'colocou', pick.id);
  return true;
}

/** Tira o pastel do cesto (ou do parceiro) e libera os cestos. Devolve o pastel que estava fritando. */
function release(tacho: Tacho, index: number): { frying: NonNullable<Tacho['baskets'][0]['frying']> } | null {
  const main = tacho.baskets[index].shadow ?? index;
  const f = tacho.baskets[main].frying;
  if (!f) return null;
  tacho.baskets[main].frying = null;
  for (const b of tacho.baskets) if (b.shadow === main) b.shadow = null;
  return { frying: f };
}

/** Tirar do óleo: o desfecho depende do tempo de fritura (RN-23). Queimado vira desperdício e libera o cesto. */
export function takeBasket(s: DayState, tacho: Tacho, index: number, extra = 0): boolean {
  const rel = release(tacho, index);
  if (!rel) return false;
  const f = rel.frying;
  if (f.burned) {
    s.stats.burned++;
    emit(s, 'descartou', f.id);
    swapDemand(s);
    return true;
  }
  const outcome = fryOutcome(fryWindow(ITEMS[f.item], tacho), f.ticks * STEP);
  s.ready.push({ id: f.id, item: f.item, quality: Math.min(100, outcomeQuality(s, tacho, outcome) + (f.bonus ?? 0) + extra), readyAt: now(s) });
  emit(s, outcome === 'ponto' ? 'tirou_no_ponto' : outcome === 'cru' ? 'tirou_cru' : 'tirou_passado', f.id);
  return true;
}

/** Toque num cesto: coloca se estiver livre, tira se estiver ocupado. */
export function tapBasket(s: DayState, station: string, index: number): boolean {
  if (!isAt(s, station as 'tacho1')) return false;
  const tacho = s.tachos[tachoIndex(station)];
  const basket = tacho?.baskets[index];
  if (!basket) return false;
  return basket.frying || basket.shadow !== null ? takeBasket(s, tacho, index) : placeBasket(s, tacho, index);
}

/** Começa a trocar o óleo, segurando o tacho (RN-42). */
export function startOilChange(s: DayState, station: string): boolean {
  const tacho = s.tachos[tachoIndex(station)];
  if (!tacho || !isAt(s, station as 'tacho1')) return false;
  s.pasteleiro.hold = { action: 'oleo', station: station as 'tacho1' };
  tacho.changeProgress = EPS;
  tacho.changeTotal = HOLD_OIL_MANUAL;
  tacho.changeBy = -1;
  return true;
}

/** Um funcionário começa a trocar o óleo: o tacho para durante `seconds` (RN-43, RN-46). */
export function startWorkerOilChange(tacho: Tacho, workerId: number, seconds: number): void {
  tacho.changeProgress = EPS;
  tacho.changeTotal = seconds;
  tacho.changeBy = workerId;
}

/** Livre para receber o próximo pastel montado? Devolve o cesto escolhido ou -1 (RN-30d). */
export function nextFreeBasket(s: DayState, tacho: Tacho): number {
  if (isLocked(tacho) || isChanging(tacho)) return -1;
  const pick = s.assembled[0];
  if (!pick) return -1;
  const big = ITEMS[pick.item].doughs > 1;
  for (let i = 0; i < tacho.baskets.length; i++) {
    if (isFree(tacho, i) && (!big || partnerBasket(tacho, i) >= 0)) return i;
  }
  return -1;
}

/** Soltar antes do fim cancela sem custo. */
export function cancelOilChange(s: DayState): void {
  for (const t of s.tachos) {
    if (t.changeBy === -1) {
      t.changeProgress = 0;
      t.changeBy = 0;
    }
  }
}

function finishOilChange(s: DayState, tacho: Tacho): void {
  const cost = tacho.oil === 'algodao' ? OIL_CHANGE_COST_COTTON : OIL_CHANGE_COST;
  tacho.dirt = 0;
  tacho.changeProgress = 0;
  s.stats.oilCost = Math.round((s.stats.oilCost + cost) * 100) / 100;
  if (tacho.changeBy === -1) s.pasteleiro.hold = null;
  tacho.changeBy = 0;
  emit(s, 'oleo_trocado');
}

/** Avança a fritura (parada durante a troca), os alarmes e o progresso da troca. */
export function updateFryers(s: DayState, dt: number): void {
  for (const tacho of s.tachos) {
    if (isChanging(tacho)) {
      tacho.changeProgress += dt;
      if (tacho.changeProgress >= tacho.changeTotal - EPS) finishOilChange(s, tacho);
      continue; // tacho parado durante a troca
    }
    for (const b of tacho.baskets) {
      const f = b.frying;
      if (!f || f.burned) continue;
      f.ticks++;
      const sec = f.ticks * STEP;
      const win = fryWindow(ITEMS[f.item], tacho);
      if (tacho.alarm) {
        if (!f.pontoAlerted && sec >= win.ponto[0] - EPS) {
          f.pontoAlerted = true;
          emit(s, 'alarme_ponto', f.id);
        }
        if (!f.burnAlerted && sec >= win.burnAt - 1 - EPS) {
          f.burnAlerted = true;
          emit(s, 'alarme_queima', f.id);
        }
      }
      if (sec >= win.burnAt - EPS) {
        f.burned = true;
        emit(s, 'queimou', f.id);
      }
    }
  }
}
