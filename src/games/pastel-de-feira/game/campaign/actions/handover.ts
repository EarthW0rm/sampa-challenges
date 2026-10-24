import { round2 } from '../campaign';
import { newCampaign } from '../campaign';
import type { Campaign, NewCampaignOptions } from '../types';

/** Passar o ponto (RN-57): vender a barraca e recomeçar com uma parte do valor. */
export const HANDOVER = { zeroedSpent: 0.5, bankruptSpent: 0.25, startShare: 0.2, minBankruptDay: 10 } as const;

export type HandoverKind = 'zerado' | 'falencia';

/** Valor do ponto: zerado = caixa + 50% do investido; falência (dia ≥ 10) = 25% do investido, sem o caixa negativo. Null se não vale. */
export function handoverValue(c: Campaign, kind: HandoverKind): number | null {
  if (kind === 'zerado') return c.freeMode ? round2(Math.max(0, c.cash) + HANDOVER.zeroedSpent * c.owned.spent) : null;
  return c.cash < 0 && c.day >= HANDOVER.minBankruptDay ? round2(HANDOVER.bankruptSpent * c.owned.spent) : null;
}

/** Campanha nova com R$ 200 + 20% do valor do ponto, novo perfil e reputação 3,0 (RN-51, RN-57). */
export function startFromHandover(value: number, opts: NewCampaignOptions): Campaign {
  const c = newCampaign(opts);
  c.cash = round2(c.cash + HANDOVER.startShare * value);
  return c;
}
