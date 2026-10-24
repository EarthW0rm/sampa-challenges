import { STEP } from '../../game/constants';
import { devConfig } from '../../game/devConfig';
import { addCustomer } from '../../game/sim/customers';
import { stockQty } from '../../game/sim/stock';
import type { DaySim } from '../../game/sim/day';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';

const secs = (n: number): number => Math.round(n / STEP);

function millSim(seed: number, config = devConfig()): DaySim {
  const sim = makeSim(seed, config);
  sim.state.arrivalLeft = 1e9;
  sim.dispatch({ type: 'tapStation', station: 'moenda' });
  advance(sim, secs(1));
  return sim;
}

export const moenda: Scenario[] = [
  {
    id: 'rn42-extracao-em-6s',
    rules: 'RN-42, RN-26, RN-31',
    run(seed) {
      const sim = millSim(seed);
      const s = sim.state;
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda' });
      advance(sim, secs(5.9));
      checkEq(s.cups.length, 0, 'ainda não saiu aos 5,9 s');
      advance(sim, secs(0.3));
      checkEq(s.cups.length, 1, 'um caldo aos 6 s');
      checkEq(stockQty(s, 'cana'), 29, '−1 dose de cana');
      checkEq(s.consumables.copo, 39, '−1 copo');
      check(sim.drainEvents().some((e) => e.type === 'caldo_pronto'), 'evento caldo_pronto');
    },
  },
  {
    id: 'soltar-mantem-progresso',
    rules: 'RN-42',
    run(seed) {
      const sim = millSim(seed);
      const s = sim.state;
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda' });
      advance(sim, secs(3));
      sim.dispatch({ type: 'holdEnd' });
      advance(sim, secs(10));
      check(s.mill.progress > 2.9 && s.mill.progress < 3.1, `progresso guardado (${s.mill.progress})`);
      checkEq(s.cups.length, 0, 'nada pronto ainda');
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda' });
      advance(sim, secs(3.2));
      checkEq(s.cups.length, 1, 'os 3 s restantes completam o caldo');
    },
  },
  {
    id: 'sem-copo-sai-do-cardapio',
    rules: 'RN-39a, RN-35',
    run(seed) {
      const config = devConfig();
      config.consumables = { copo: 0, saquinho: 100, embalagem: 0 };
      const sim = millSim(seed, config);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne', 'caldo-puro']);
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda' });
      sim.step();
      checkEq(s.rejected, 1, 'sem copo não extrai');
      checkEq(s.pasteleiro.hold, null, 'sem segurar');
      check(!s.customers.includes(c), 'quem pediu caldo sem substituto vai embora');
      checkNear(s.rep.failures, 0.5, 'falha de peso 0,5');
    },
  },
  {
    id: 'rn26-caldo-sem-nota',
    rules: 'RN-26',
    run(seed) {
      const sim = millSim(seed, devConfig({ reputation: 4 }));
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['caldo-puro']);
      s.cups.push({ id: 1, item: 'caldo-puro' });
      sim.dispatch({ type: 'tapStation', station: 'balcao' });
      advance(sim, secs(2));
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'anotar' } });
      sim.step();
      sim.dispatch({ type: 'deliver', item: { kind: 'copo', id: 1 }, customerId: c.id });
      sim.step();
      checkEq(s.coins.length, 1, 'pago');
      checkNear(s.coins[0].amount, 6 * 1.1, 'preço × prêmio de reputação (4 estrelas), sem fator de qualidade');
      checkEq(s.consumables.saquinho, 100, 'caldo não gasta saquinho');
    },
  },
];
