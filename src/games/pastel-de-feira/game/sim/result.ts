import { REPUTATION_MAX_DAILY_CHANGE, REPUTATION_RATE_GAIN, REPUTATION_TARGET_RATE } from '../constants';
import type { DayResult } from '../types';
import type { DayState } from './state';

const round2 = (v: number): number => Math.round(v * 100) / 100;
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/**
 * Taxa e variação de reputação do dia (RN-62, RN-64). A campanha aplica a variação no fechamento.
 * Taxa = (sucessos + encanto) ÷ (sucessos + encanto + falhas ponderadas). Sem pedidos: variação 0.
 */
export function reputationChange(successes: number, charm: number, failures: number): { rate: number; change: number } {
  const total = successes + charm + failures;
  if (successes + failures <= 0 || total <= 0) return { rate: 0, change: 0 };
  const rate = (successes + charm) / total;
  const change = clamp((rate - REPUTATION_TARGET_RATE) * REPUTATION_RATE_GAIN, -REPUTATION_MAX_DAILY_CHANGE, REPUTATION_MAX_DAILY_CHANGE);
  return { rate, change };
}

/** Monta o `DayResult` no corte seco (RN-07): prontos e montados contam como desperdício. */
export function buildResult(s: DayState): DayResult {
  let burned = s.stats.burned;
  let leftover = s.assembled.length + s.ready.length + s.cups.length;
  for (const t of s.tachos) {
    for (const b of t.baskets) {
      if (!b.frying) continue;
      if (b.frying.burned) burned++;
      else leftover++;
    }
  }
  const { successes, charm, failures } = s.rep;
  const { rate, change } = reputationChange(successes, charm, failures);
  return {
    day: s.config.day,
    ticks: s.tick,
    revenue: { counter: round2(s.stats.revenue - s.stats.tableRevenue - s.stats.appRevenue - s.stats.orderRevenue), table: s.stats.tableRevenue, app: s.stats.appRevenue, order: s.stats.orderRevenue, total: s.stats.revenue },
    costs: { oil: s.stats.oilCost, fines: s.stats.fines, repairs: s.stats.repairs },
    orders: {
      served: s.stats.served,
      lostPatience: s.stats.lostPatience,
      wrong: s.stats.wrong,
      queueFull: s.stats.queueFull,
      lostPrice: s.stats.lostPrice,
      noStock: s.stats.noStock,
      lostDirt: s.stats.lostDirt,
      payFail: s.stats.payFail,
      appPicked: s.stats.appPicked,
      appCancelled: s.stats.appCancelled,
      encDone: s.stats.encDone,
      encFailed: s.stats.encFailed,
    },
    waste: { burned, leftover },
    reputation: { successes, charm, weightedFailures: failures, rate, change },
    stockLeft: s.stock.map((l) => ({ ...l })),
    consumables: { ...s.consumables },
    counters: { drinks: s.stats.drinks, especial: s.stats.especial, inspection: s.stats.inspection, annulled: s.stats.annulled },
    events: [...s.world.log],
    giftCost: Math.round(s.stats.giftCost * 100) / 100,
    staff: s.workers.map((w) => ({ id: w.id, idleSeconds: w.idleSeconds, restSeconds: w.restSeconds, endEnergy: w.energy, minEnergy: w.minEnergy })),
  };
}
