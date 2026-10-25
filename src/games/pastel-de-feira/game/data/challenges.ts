import { SPACE } from './equipment';
import type { Campaign } from '../campaign/types';
import type { DayResult } from '../types';

/** Desafios da Associação da Feira (RN-135–137). Valores (P). */

export interface ChallengeDef {
  id: string;
  name: string;
  prize: number;
  /** Dias do calendário para cumprir (a contar do aceite). */
  days: number;
  /** Só é oferecido se for atingível com o que a barraca pode comprar (RN-137). */
  available: (c: Campaign) => boolean;
  /**
   * Avalia o dia que acabou. `after` é a campanha já com a reputação e a contagem do fim do dia;
   * `waste` é o percentual de desperdício. Devolve o progresso novo e se concluiu.
   */
  evaluate: (ctx: { after: Campaign; result: DayResult; waste: number; progress: number }) => { progress: number; done: boolean };
}

const hasWaiterFixed = (c: Campaign): boolean => c.staff.some((s) => s.mode === 'fixo' && s.position === 'garcom');

/** Dá para ter `tables` mesas (e o espaço delas) respeitando o limite de 24 m²? */
function canHaveTables(c: Campaign, tables: number): boolean {
  const missing = Math.max(0, tables - c.owned.tables);
  const freeAfter = c.owned.extraM2 - ((c.owned.tachos.length - 1) * 2 + c.owned.coolers + c.owned.tables * 2 + (c.owned.delivery ? 3 : 0) + (c.owned.office ? 4 : 0) + (c.owned.rest > 0 ? 1 : 0));
  const needM2 = Math.max(0, missing * 2 - freeAfter);
  return SPACE.base + c.owned.extraM2 + needM2 <= SPACE.max;
}

// RN-136
export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'caldos-40', name: 'Servir 40 caldos num dia', prize: 150, days: 5,
    available: () => true,
    evaluate: ({ result }) => ({ progress: result.counters.drinks, done: result.counters.drinks >= 40 }),
  },
  {
    id: 'mesas-garcom', name: 'Ter 2 mesas e um garçom', prize: 200, days: 6,
    available: (c) => canHaveTables(c, 2),
    evaluate: ({ after }) => ({ progress: after.owned.tables, done: after.owned.tables >= 2 && hasWaiterFixed(after) }),
  },
  {
    id: 'sem-cancelar-3d', name: 'Nenhuma comanda cancelada por 3 dias', prize: 300, days: 8,
    available: (c) => c.owned.delivery,
    evaluate: ({ after, result, progress }) => {
      const ok = after.deliveryOn && result.orders.appCancelled === 0;
      const next = ok ? progress + 1 : 0;
      return { progress: next, done: next >= 3 };
    },
  },
  {
    id: 'desperdicio-10', name: 'Desperdício abaixo de 10% num dia', prize: 150, days: 5,
    available: () => true,
    evaluate: ({ after, waste }) => ({ progress: 0, done: after.boughtToday > 0 && waste < 0.1 }),
  },
  {
    id: 'quatro-estrelas', name: 'Chegar a 4 estrelas', prize: 400, days: 10,
    available: (c) => c.reputation < 4,
    evaluate: ({ after }) => ({ progress: Math.floor(after.reputation * 10) / 10, done: after.reputation >= 4 }),
  },
  {
    id: 'fiscalizacao', name: 'Passar numa fiscalização', prize: 200, days: 8,
    available: (c) => c.eventsOn && c.day >= 4,
    evaluate: ({ result }) => ({ progress: 0, done: result.counters.inspection === 'passed' }),
  },
  {
    id: 'especial-30', name: 'Vender 30 Especiais da Casa num dia', prize: 350, days: 8,
    available: (c) => c.owned.items.includes('especial'),
    evaluate: ({ result }) => ({ progress: result.counters.especial, done: result.counters.especial >= 30 }),
  },
];

export const challengeById = (id: string): ChallengeDef | undefined => CHALLENGES.find((d) => d.id === id);

export const MAX_ACTIVE_CHALLENGES = 3;
export const CHALLENGE_OFFERS = 2;
export const CHALLENGE_OFFERS_WITH_DISPATCHER = 3;
