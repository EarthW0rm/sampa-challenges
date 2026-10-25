import { SEASONS, SEASON_DAYS, type Season } from '../data/events';

/**
 * Estação do contador de dias (RN-140): dias 1–5 Verão, 6–10 Outono, 11–15 Inverno, 16–20 Primavera,
 * e o ciclo se repete no modo livre. O dia repetido por meta mantém a estação porque o contador não anda.
 */
export function seasonOf(day: number): Season {
  const d = Math.max(1, Math.floor(day));
  return SEASONS[Math.floor((d - 1) / SEASON_DAYS) % SEASONS.length];
}
