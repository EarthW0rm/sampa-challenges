import { currentQuality } from '../quality';
import { emit, now, type DayState } from '../state';

/** Vagas da estufa: 0 sem estufa, 6 ou 12 com a estufa grande (RN-27). */
export const warmerCapacity = (s: DayState): number => s.config.equipment.warmer;

export const warmedCount = (s: DayState): number => s.ready.filter((r) => r.warmed).length;

/**
 * Guarda um pastel pronto na estufa, a vitrine em cima do balcão (RN-27): acontece sozinho quando o pastel
 * sai do óleo. A nota fica congelada por 60 s e depois cai 1 ponto/s. A estufa é compartilhada entre
 * balcão, mesa e app (RN-96). Cheia: o pastel fica no balcão.
 */
export function warmReady(s: DayState, id: number): boolean {
  const r = s.ready.find((x) => x.id === id);
  if (!r || r.warmed || warmedCount(s) >= warmerCapacity(s)) return false;
  r.quality = currentQuality(r, now(s));
  r.readyAt = now(s);
  r.warmed = true;
  emit(s, 'estufa', r.id);
  return true;
}
