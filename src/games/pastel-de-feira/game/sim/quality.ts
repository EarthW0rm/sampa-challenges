import {
  DECAY_DELAY, DECAY_PER_SECOND, QUALITY_FACTOR_MIN, QUALITY_FACTOR_SPAN, REPUTATION_PREMIUM,
} from '../constants';
import { WARMER } from '../data/equipment';
import { starTier } from './customers';
import type { Ready } from './state';

const clampQuality = (q: number): number => Math.max(0, Math.min(100, q));

/** Fator de qualidade do valor pago: de 0,8× (nota 0) a 1,2× (nota 100) (RN-21). */
export const qualityFactor = (nota: number): number => QUALITY_FACTOR_MIN + QUALITY_FACTOR_SPAN * (clampQuality(nota) / 100);

/** Prêmio de reputação: 1,0 abaixo de 4 estrelas, 1,10 com 4 e 1,20 com 5 (RN-22). */
export const reputationPremium = (rep: number): number => REPUTATION_PREMIUM[starTier(rep)] ?? 1;

/** Valor pago por um pastel (RN-20). `tablePremium` entra na US de mesas. Sem arredondar: centavos só no pagamento. */
export const pastryValue = (price: number, nota: number, rep: number, tablePremium = 1): number =>
  price * qualityFactor(nota) * reputationPremium(rep) * tablePremium;

/** Caldo não tem nota (RN-26). */
export const drinkValue = (price: number, rep: number): number => price * reputationPremium(rep);

/**
 * Nota atual de um pastel pronto: perde 2 pontos/s depois de 10 s de espera (RN-25). Na estufa a nota
 * fica congelada por 60 s e depois cai 1 ponto/s (RN-27).
 */
export function currentQuality(r: Ready, t: number): number {
  if (r.warmed || r.boxed) {
    const waited = Math.max(0, t - r.readyAt - WARMER.holdSeconds);
    return clampQuality(r.quality - waited * WARMER.decayPerSecond);
  }
  const waited = Math.max(0, t - r.readyAt - DECAY_DELAY);
  return clampQuality(r.quality - waited * DECAY_PER_SECOND);
}

export const roundCents = (v: number): number => Math.round(v * 100) / 100;
