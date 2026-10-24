import { STEP } from '../../game/constants';
import { devConfig } from '../testConfig';
import type { DaySim } from '../../game/sim/day';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';

const secs = (n: number): number => Math.round(n / STEP);

/** Pasteleiro no tacho, sem chegadas aleatórias, com `n` Carnes montadas. */
function fryerSim(seed: number, n = 1, config = devConfig()): DaySim {
  const sim = makeSim(seed, config);
  sim.state.arrivalLeft = 1e9;
  for (let i = 0; i < n; i++) sim.state.assembled.push({ id: 100 + i, item: 'carne' });
  sim.dispatch({ type: 'tapStation', station: 'tacho1' });
  advance(sim, secs(1));
  return sim;
}

const tapBasket = (sim: DaySim, index: number) => {
  sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index } });
  sim.step();
};

/** Coloca, espera `seconds` de fritura e tira. Devolve o pastel pronto. */
function fryFor(seconds: number, seed: number) {
  const sim = fryerSim(seed);
  tapBasket(sim, 0);
  advance(sim, secs(seconds));
  tapBasket(sim, 0);
  return sim;
}

export const tacho: Scenario[] = [
  {
    id: 'rn23-desfechos',
    rules: 'RN-23',
    run(seed) {
      // Carne: ponto 5–8 s, queima em 10 s
      checkEq(fryFor(3, seed).state.ready[0].quality, 40, 'cru = 40');
      checkEq(fryFor(6, seed).state.ready[0].quality, 80, 'no ponto = 80');
      checkEq(fryFor(9, seed).state.ready[0].quality, 55, 'passado = 55');
      const queimou = fryFor(10, seed);
      checkEq(queimou.state.ready.length, 0, 'queimado não pode ser vendido');
      checkEq(queimou.state.stats.burned, 1, 'conta no desperdício');
      checkEq(queimou.state.tachos[0].baskets[0].frying, null, 'cesto liberado ao descartar');
    },
  },
  {
    id: 'queimado-bloqueia-cesto',
    rules: 'RN-23, spec 4',
    run(seed) {
      const sim = fryerSim(seed, 2);
      tapBasket(sim, 0);
      advance(sim, secs(11));
      const f = sim.state.tachos[0].baskets[0].frying!;
      check(f.burned, 'queimou sozinho');
      sim.state.assembled.push({ id: 7, item: 'carne' });
      tapBasket(sim, 0); // tira o queimado: o cesto só libera aqui
      checkEq(sim.state.tachos[0].baskets[0].frying, null, 'descartado');
      check(sim.drainEvents().some((e) => e.type === 'queimou'), 'evento queimou');
    },
  },
  {
    id: 'tacho-pequeno-tem-2-cestos',
    rules: 'RN-70, RN-73',
    run(seed) {
      const sim = fryerSim(seed, 3);
      checkEq(sim.state.tachos[0].baskets.length, 2, 'cestos do tacho pequeno');
      tapBasket(sim, 0);
      tapBasket(sim, 1);
      tapBasket(sim, 2);
      checkEq(sim.state.rejected, 1, 'cesto inexistente é descartado');
      checkEq(sim.state.assembled.length, 1, 'sobrou um montado');
    },
  },
  {
    id: 'colocar-sem-montado',
    rules: 'RN-42',
    run(seed) {
      const sim = fryerSim(seed, 0);
      tapBasket(sim, 0);
      checkEq(sim.state.rejected, 1, 'sem pastel montado não coloca');
    },
  },
  {
    id: 'rn46-oleo-trava-em-25',
    rules: 'RN-46, spec 4',
    run(seed) {
      const sim = fryerSim(seed, 30);
      let colocados = 0;
      for (let i = 0; i < 25; i++) {
        tapBasket(sim, 0);
        if (sim.state.tachos[0].baskets[0].frying) colocados++;
        // tira logo (cru) para liberar o cesto
        tapBasket(sim, 0);
      }
      checkEq(colocados, 25, '25 pastéis fritos');
      checkNear(sim.state.tachos[0].dirt, 1, 'óleo em 100%');
      const antes = sim.state.assembled.length;
      tapBasket(sim, 0);
      checkEq(sim.state.assembled.length, antes, 'tacho travado não aceita mais');
    },
  },
  {
    id: 'rn46-travado-cestos-seguem',
    rules: 'spec 4',
    run(seed) {
      const sim = fryerSim(seed, 30);
      for (let i = 0; i < 24; i++) {
        tapBasket(sim, 0);
        tapBasket(sim, 0);
      }
      tapBasket(sim, 0); // 25º: trava
      checkNear(sim.state.tachos[0].dirt, 1, 'travou');
      advance(sim, secs(11));
      check(sim.state.tachos[0].baskets[0].frying!.burned, 'cesto em uso continuou fritando e queimou');
    },
  },
  {
    id: 'rn24-oleo-sujo-reduz-nota',
    rules: 'RN-24',
    run(seed) {
      const sim = fryerSim(seed, 30);
      for (let i = 0; i < 17; i++) {
        tapBasket(sim, 0);
        tapBasket(sim, 0);
      }
      checkNear(sim.state.tachos[0].dirt, 0.68, 'óleo a 68%');
      sim.state.ready.length = 0;
      tapBasket(sim, 0); // 18º pastel: 72% de sujeira, óleo sujo
      advance(sim, secs(6));
      tapBasket(sim, 0);
      checkEq(sim.state.ready[0].quality, 65, 'no ponto com óleo sujo = 80 − 15');
    },
  },
  {
    id: 'rn42-troca-de-oleo',
    rules: 'RN-42, RN-46',
    run(seed) {
      const sim = fryerSim(seed, 5);
      for (let i = 0; i < 5; i++) {
        tapBasket(sim, 0);
        tapBasket(sim, 0);
      }
      check(sim.state.tachos[0].dirt > 0, 'óleo sujo');
      // soltar antes: cancela sem custo
      sim.dispatch({ type: 'holdStart', station: 'tacho1', action: 'oleo' });
      advance(sim, secs(4));
      sim.dispatch({ type: 'holdEnd' });
      advance(sim, secs(1));
      check(sim.state.tachos[0].dirt > 0, 'troca interrompida não limpa');
      checkEq(sim.state.stats.oilCost, 0, 'troca interrompida não cobra');
      // segurar 8 s: troca completa
      sim.dispatch({ type: 'holdStart', station: 'tacho1', action: 'oleo' });
      advance(sim, secs(7.5));
      check(sim.state.tachos[0].dirt > 0, 'ainda não terminou aos 7,5 s');
      advance(sim, secs(1));
      checkEq(sim.state.tachos[0].dirt, 0, 'sujeira zerada');
      checkEq(sim.state.stats.oilCost, 25, 'custo R$ 25');
      check(sim.drainEvents().some((e) => e.type === 'oleo_trocado'), 'evento oleo_trocado');
    },
  },
  {
    id: 'troca-para-o-tacho',
    rules: 'RN-46',
    run(seed) {
      const sim = fryerSim(seed, 2);
      tapBasket(sim, 0);
      sim.dispatch({ type: 'holdStart', station: 'tacho1', action: 'oleo' });
      advance(sim, secs(3));
      checkEq(sim.state.tachos[0].baskets[0].frying!.ticks, 1, 'durante a troca o pastel não frita');
      tapBasket(sim, 1);
      checkEq(sim.state.tachos[0].baskets[1].frying, null, 'e nada novo entra');
    },
  },
  {
    id: 'sair-da-estacao-cancela-troca',
    rules: 'RN-42',
    run(seed) {
      const sim = fryerSim(seed, 0);
      sim.dispatch({ type: 'holdStart', station: 'tacho1', action: 'oleo' });
      advance(sim, secs(3));
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, secs(10));
      checkEq(sim.state.stats.oilCost, 0, 'sem custo');
      checkEq(sim.state.tachos[0].changeProgress, 0, 'progresso zerado');
    },
  },
];
