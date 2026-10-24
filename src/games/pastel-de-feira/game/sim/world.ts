import { FORECAST, SEASON_EFFECTS } from '../data/events';
import type { DayState } from './state';

/** Efeitos da estação e dos eventos previstos do dia (RN-141, RN-151). */
export const seasonFx = (s: DayState) => SEASON_EFFECTS[s.config.season];

export const isRaining = (s: DayState): boolean => s.config.forecast === 'chuva';
export const isHeat = (s: DayState): boolean => s.config.forecast === 'calor';
export const tablesBlocked = (s: DayState): boolean => s.config.forecast === 'subprefeitura';

/** Multiplicador da chance de pedir caldo: estação e calor forte acumulam (RN-141, RN-151). */
export const drinkFactor = (s: DayState): number => seasonFx(s).drink * (isHeat(s) ? FORECAST.heatDrink : 1);

/** Multiplicador do cansaço: Verão e calor forte acumulam (RN-141, RN-151). */
export const fatigueFactor = (s: DayState): number => seasonFx(s).fatigue * (isHeat(s) ? FORECAST.heatFatigue : 1);
