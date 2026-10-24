import { BOT_NAMES, playCampaign, type BotName, type Run } from './bots';

/** Critério da spec (seção 5) verificado para cada robô numa semente. */
export interface Check {
  bot: BotName;
  criterio: string;
  passou: (run: Run) => boolean;
}

const rowOf = (run: Run, day: number) => run.rows.find((r) => r.day === day);

export const CHECKS: readonly Check[] = [
  {
    bot: 'solo',
    criterio: 'Metas dos dias 1 a 3 cumpridas (piso de equilíbrio)',
    passou: (r) => [1, 2, 3].every((d) => rowOf(r, d)?.met === true),
  },
  {
    bot: 'armadilha',
    criterio: 'Delivery no dia 5 sem equipe derruba a reputação no mesmo dia',
    passou: (r) => {
      const d5 = rowOf(r, 5);
      return !!d5 && d5.repAfter < d5.repBefore;
    },
  },
  {
    bot: 'brinde-max',
    criterio: 'Brinde 2 + chorinho 3 com equipe: nos 4 primeiros dias a reputação sobe mais que a do equilibrado (ou ambas no teto) e o lucro fica abaixo da meta em ≥ 3',
    passou: (r) => {
      const rows = r.rows.filter((x) => x.promo).slice(0, 4);
      if (rows.length < 4) return false;
      const base = playCampaign('equilibrado', r.seed, 20).rows;
      const first = new Map<number, Run['rows'][number]>();
      for (const x of base) if (!first.has(x.day)) first.set(x.day, x);
      const ref = rows.map((x) => first.get(x.day)).filter((x): x is Run['rows'][number] => !!x);
      const gain = rows[rows.length - 1].repAfter - rows[0].repBefore;
      const refGain = ref.length === rows.length ? ref[ref.length - 1].repAfter - ref[0].repBefore : 0;
      const below = rows.filter((x) => x.goal !== null && x.profit < x.goal).length >= 3;
      return gain >= refGain - 0.05 && below;
    },
  },
  {
    bot: 'equilibrado',
    criterio: 'Campanha de 20 dias vencível e meta do dia 20 não trivial',
    passou: (r) => {
      const d20 = rowOf(r, 20);
      return !r.bankrupt && !!d20 && d20.goal !== null && d20.profit < d20.goal * 2.5;
    },
  },
];

export interface BotReport {
  bot: BotName;
  criterio: string;
  seeds: number;
  passaram: number;
  taxa: number;
  ok: boolean;
  /** Médias por dia (dia → métricas) para o relatório. */
  dias: { day: number; profit: number; goal: number | null; met: number; rep: number; served: number; lost: number; burned: number; n: number }[];
}

export const PASS_RATE = 0.8;

export function runBot(bot: BotName, seeds: number, days: number): BotReport {
  const check = CHECKS.find((c) => c.bot === bot)!;
  let passaram = 0;
  const acc = new Map<number, { profit: number; goal: number; met: number; rep: number; served: number; lost: number; burned: number; n: number }>();
  for (let seed = 1; seed <= seeds; seed++) {
    const run = playCampaign(bot, seed, days);
    if (check.passou(run)) passaram++;
    const seen = new Set<number>();
    for (const r of run.rows) {
      if (seen.has(r.day)) continue; // a tabela usa a primeira tentativa de cada dia
      seen.add(r.day);
      const a = acc.get(r.day) ?? { profit: 0, goal: 0, met: 0, rep: 0, served: 0, lost: 0, burned: 0, n: 0 };
      a.profit += r.profit;
      a.goal += r.goal ?? 0;
      a.met += r.met ? 1 : 0;
      a.rep += r.repAfter;
      a.served += r.served;
      a.lost += r.lostPatience + r.lostPrice + r.noStock;
      a.burned += r.burned;
      a.n++;
      acc.set(r.day, a);
    }
  }
  const dias = [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, a]) => ({ day, profit: a.profit / a.n, goal: a.goal / a.n || null, met: a.met / a.n, rep: a.rep / a.n, served: a.served / a.n, lost: a.lost / a.n, burned: a.burned / a.n, n: a.n }));
  return { bot, criterio: check.criterio, seeds, passaram, taxa: passaram / seeds, ok: passaram / seeds >= PASS_RATE, dias };
}

export function runBots(names: readonly BotName[], seeds: number, days: number): BotReport[] {
  return names.map((n) => runBot(n, seeds, days));
}

export function formatReport(reports: readonly BotReport[]): string {
  const out: string[] = [];
  for (const r of reports) {
    out.push(`\n== ${r.bot}: ${r.criterio}`);
    out.push(`   ${r.passaram}/${r.seeds} sementes (${Math.round(r.taxa * 100)}%) -> ${r.ok ? 'PASSOU' : 'FALHOU'} (mínimo ${PASS_RATE * 100}%)`);
    out.push('   dia  lucro   meta  meta ok  rep  atend  perdidos  queimados  n');
    for (const d of r.dias) {
      out.push(
        `   ${String(d.day).padStart(3)}  ${d.profit.toFixed(0).padStart(5)}  ${(d.goal ?? 0).toFixed(0).padStart(5)}  ${(d.met * 100).toFixed(0).padStart(6)}%  ${d.rep.toFixed(1)}  ${d.served.toFixed(0).padStart(5)}  ${d.lost.toFixed(0).padStart(8)}  ${d.burned.toFixed(0).padStart(9)}  ${d.n}`,
      );
    }
  }
  return out.join('\n');
}

export { BOT_NAMES };
