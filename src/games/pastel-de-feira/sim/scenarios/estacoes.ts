import { seasonOf } from '../../game/campaign/season';
import { toDayConfig, newCampaign } from '../../game/campaign/campaign';
import { spawnCustomer } from '../../game/sim/customers';
import { fatigueRate } from '../../game/sim/staff';
import type { DayConfig } from '../../game/types';
import { check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import { tableConfig } from './mesas';

const sample = (config: DayConfig, seed: number, N = 5000): { drinks: number; two: number } => {
  const sim = makeSim(seed, config);
  const s = sim.state;
  let drinks = 0;
  let two = 0;
  let n = 0;
  for (let i = 0; i < N; i++) {
    s.customers.length = 0;
    spawnCustomer(s, 'padrao');
    const c = s.customers[0];
    if (!c) continue;
    n++;
    const pastries = c.lines.filter((l) => l.item !== 'caldo-puro');
    if (pastries.length >= 2) two++;
    if (c.lines.some((l) => l.item === 'caldo-puro')) drinks++;
  }
  return { drinks: drinks / n, two: two / n };
};

export const estacoes: Scenario[] = [
  {
    id: 'rn140-estacao-pelo-contador-de-dias',
    rules: 'RN-140',
    run() {
      const por = (d: number) => seasonOf(d);
      checkEq(por(1), 'verao', 'dia 1');
      checkEq(por(5), 'verao', 'dia 5');
      checkEq(por(6), 'outono', 'dia 6');
      checkEq(por(11), 'inverno', 'dia 11');
      checkEq(por(16), 'primavera', 'dia 16');
      checkEq(por(21), 'verao', 'o ciclo se repete no modo livre');
      checkEq(por(26), 'outono', 'e segue');
      const c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 1 });
      c.day = 6;
      c.calendar = 9;
      checkEq(toDayConfig(c).season, 'outono', 'o dia repetido mantém a estação do contador');
    },
  },
  {
    id: 'rn141-verao-mais-caldo',
    rules: 'RN-141',
    run(seed) {
      const base = sample(tableConfig(0, { season: 'outono' }), seed);
      const verao = sample(tableConfig(0, { season: 'verao' }), seed + 1);
      const inverno = sample(tableConfig(0, { season: 'inverno' }), seed + 2);
      check(Math.abs(base.drinks - 0.4) < 0.03, `base ${base.drinks}`);
      check(Math.abs(verao.drinks - 0.56) < 0.03, `Verão: +40% (${verao.drinks})`);
      check(Math.abs(inverno.drinks - 0.24) < 0.03, `Inverno: −40% (${inverno.drinks})`);
      check(Math.abs(base.two - 0.5) < 0.03, `base de 2 pastéis ${base.two}`);
      check(Math.abs(inverno.two - 0.6) < 0.03, `Inverno: 2 pastéis +20% (${inverno.two})`);
    },
  },
  {
    id: 'rn141-verao-cansa-25-por-cento-mais',
    rules: 'RN-141',
    run(seed) {
      checkNear(fatigueRate(makeSim(seed, tableConfig(0, { season: 'verao' })).state), 1.25, 'Verão');
      checkNear(fatigueRate(makeSim(seed, tableConfig(0, { season: 'inverno' })).state), 1, 'Inverno');
    },
  },
];
