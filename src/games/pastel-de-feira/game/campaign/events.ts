import { EVENTS_FIRST_DAY, FORECAST, SEASON_EFFECTS, type Forecast } from '../data/events';
import { Rng } from '../rng';
import type { DayResult } from '../types';
import { cloneCampaign } from './campaign';
import { seasonOf } from './season';
import type { ActionResult, Campaign } from './types';

/**
 * Evento previsto do dia (RN-150, RN-151): sorteado com a semente da campanha e o calendário, então
 * não muda quando o dia é retomado (PA-13). Só a partir do dia 4 e com eventos ligados.
 */
export function rollForecast(c: Campaign): Forecast | null {
  if (!c.eventsOn || c.day < EVENTS_FIRST_DAY) return null;
  const rng = new Rng(c.seed).fork(`previsto:${c.calendar}`);
  const season = seasonOf(c.day);
  const hits: Forecast[] = [];
  if (rng.chance(SEASON_EFFECTS[season].rain)) hits.push('chuva');
  if (season === 'verao' && rng.chance(FORECAST.calorChance)) hits.push('calor');
  if (rng.chance(FORECAST.subprefeituraChance)) hits.push('subprefeitura');
  return hits.length ? rng.pick(hits) : null;
}

/** Reivindicação: depois de um dia em que alguém chegou a energia 0; ×2 com Pavio curto, ×0,5 com Gerente (RN-151). */
export function rollClaim(c: Campaign, result: DayResult): boolean {
  if (!c.eventsOn || c.day < EVENTS_FIRST_DAY) return false;
  if (!result.staff.some((w) => w.minEnergy <= 0.0001)) return false;
  let p = FORECAST.claimChance;
  if (c.staff.some((w) => w.traits.includes('pavio-curto'))) p *= FORECAST.claimPavio;
  if (c.roles.includes('gerente')) p *= FORECAST.claimManager;
  return new Rng(c.seed).fork(`reivindicacao:${c.calendar}`).chance(Math.min(1, p));
}

/** Resposta à reivindicação: pausa (exige área de descanso), aumento de 10% por 3 dias ou recusa (RN-151). */
export function respondClaim(c: Campaign, choice: 'pausa' | 'aumento' | 'recusada'): ActionResult {
  if (c.claim !== 'pendente') return { ok: false, motivo: 'requer' };
  if (choice === 'pausa' && c.owned.rest === 0) return { ok: false, motivo: 'requer' };
  const next = cloneCampaign(c);
  next.claim = choice;
  if (choice === 'aumento') next.raiseUntil = c.calendar + FORECAST.claimRaiseDays - 1;
  return { ok: true, campaign: next };
}
