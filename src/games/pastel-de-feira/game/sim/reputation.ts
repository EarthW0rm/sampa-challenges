import type { DayState } from './state';

/** Registro dos desfechos do dia (RN-61, RN-62). A taxa e a variação saem no `result()` (TF-110-09). */
export const recordSuccess = (s: DayState): void => {
  s.rep.successes += 1;
};

export const recordFailure = (s: DayState, weight: number): void => {
  s.rep.failures += weight;
};

export const addCharm = (s: DayState, points: number): void => {
  s.rep.charm += points;
};
