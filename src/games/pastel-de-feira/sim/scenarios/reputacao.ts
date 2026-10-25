import { DECAY_DELAY, DECAY_PER_SECOND } from '../../game/constants';
import { devConfig } from '../testConfig';
import { currentQuality, drinkValue, pastryValue, qualityFactor, reputationPremium } from '../../game/sim/quality';
import { buildResult, reputationChange } from '../../game/sim/result';
import { addCustomer } from '../../game/sim/customers';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';

const dayWith = (seed: number, rep = 3) => {
  const sim = makeSim(seed, devConfig({ reputation: rep }));
  sim.state.arrivalLeft = 1e9;
  return sim;
};

export const reputacao: Scenario[] = [
  {
    id: 'rn20-22-valor-pago',
    rules: 'RN-20, RN-21, RN-22',
    run() {
      checkNear(qualityFactor(100), 1.2, 'nota 100 → ×1,2');
      checkNear(qualityFactor(0), 0.8, 'nota 0 → ×0,8');
      checkNear(qualityFactor(250), 1.2, 'nota acima de 100 é limitada');
      checkNear(qualityFactor(-5), 0.8, 'nota abaixo de 0 é limitada');
      checkNear(reputationPremium(3.5), 1, 'abaixo de 4 estrelas');
      checkNear(reputationPremium(4), 1.1, '4 estrelas');
      checkNear(reputationPremium(5), 1.2, '5 estrelas');
      checkNear(pastryValue(8, 80, 3), 8.96, 'caso 1');
      checkNear(pastryValue(8, 100, 5), 11.52, 'caso 2');
      checkNear(pastryValue(8, 0, 3), 6.4, 'caso 3');
      checkNear(pastryValue(8, 55, 4), 8.976, 'caso 4');
      checkNear(pastryValue(11, 40, 5), 12.672, 'caso 5');
      checkNear(pastryValue(8, 80, 3, 1.15), 8.96 * 1.15, 'prêmio de mesa');
      checkNear(drinkValue(7, 5), 8.4, 'caldo sem nota, com prêmio');
    },
  },
  {
    id: 'rn25-decaimento',
    rules: 'RN-25',
    run() {
      const r = { id: 1, item: 'carne', quality: 80, readyAt: 100 };
      checkEq(currentQuality(r, 100 + DECAY_DELAY / 2), 80, 'sem perda no começo da espera');
      checkEq(currentQuality(r, 100 + DECAY_DELAY), 80, 'no fim do atraso ainda 80');
      checkEq(currentQuality(r, 100 + DECAY_DELAY + 20), 80 - 20 * DECAY_PER_SECOND, 'depois perde DECAY_PER_SECOND por segundo');
      checkEq(currentQuality(r, 500), 0, 'nunca abaixo de 0');
    },
  },
  {
    id: 'rn62-64-taxa-e-variacao',
    rules: 'RN-62, RN-64',
    run() {
      checkNear(reputationChange(3, 0, 1).change, 0, 'taxa 0,75 → 0');
      checkNear(reputationChange(5, 0, 0).change, 0.5, 'taxa 1 → +0,5');
      checkNear(reputationChange(0, 0, 4).change, -1, 'taxa 0 → −1,0 (limitado)');
      checkNear(reputationChange(1, 0, 3).change, -1, 'taxa 0,25 → −1,0');
      checkNear(reputationChange(3, 1, 1).rate, 0.8, 'encanto entra na taxa');
      const vazio = reputationChange(0, 0, 0);
      checkEq(vazio.change, 0, 'dia sem pedidos não altera a reputação');
      check(!Number.isNaN(vazio.rate), 'sem NaN');
    },
  },
  {
    id: 'rn15-qualidade-abaixo-da-exigencia',
    rules: 'RN-15, RN-11',
    run(seed) {
      const sim = dayWith(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne']);
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'anotar' } });
      sim.step();
      s.ready.push({ id: 1, item: 'carne', quality: 20, readyAt: 0 }); // Padrão exige 50 (recém-pronto: sem decaimento)
      sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: 1 }, customerId: c.id });
      sim.step();
      checkEq(s.coins.length, 1, 'é pago');
      checkEq(s.rep.successes, 0, 'mas não é sucesso');
      checkNear(s.rep.failures, 1, 'conta como falha');
    },
  },
  {
    id: 'rn28-sem-saquinho',
    rules: 'RN-28',
    run(seed) {
      const config = devConfig();
      config.consumables = { copo: 10, saquinho: 0, embalagem: 0 };
      const sim = makeSim(seed, config);
      const s = sim.state;
      s.arrivalLeft = 1e9;
      const c = addCustomer(s, 'economico', ['carne']);
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'anotar' } });
      sim.step();
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: s.tick / 60 });
      sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: 1 }, customerId: c.id });
      sim.step();
      checkNear(s.coins[0].amount, 7 * (0.8 + 0.4 * 0.7), 'nota 70 depois do desconto de 10 pontos');
    },
  },
  {
    id: 'rn07-desperdicio-no-corte-seco',
    rules: 'RN-07',
    run(seed) {
      const sim = dayWith(seed);
      const s = sim.state;
      s.assembled.push({ id: 1, item: 'carne' });
      s.ready.push({ id: 2, item: 'carne', quality: 80, readyAt: 0 });
      s.cups.push({ id: 3, item: 'caldo-puro' });
      advance(sim, 15000);
      const r = sim.result()!;
      checkEq(r.waste.leftover, 3, 'montado, pronto e copo contam como desperdício');
      checkNear(r.reputation.weightedFailures, 0, 'corte seco não gera falha');
      checkEq(r.reputation.change, 0, 'dia sem pedidos: variação 0');
      const direto = buildResult(s);
      checkEq(direto.waste.leftover, 3, 'buildResult é puro');
    },
  },
];
