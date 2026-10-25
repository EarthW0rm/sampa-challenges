import { DECAY_DELAY, DECAY_PER_SECOND, STEP } from '../../game/constants';
import { addCustomer, spawnCustomer } from '../../game/sim/customers';
import { currentQuality } from '../../game/sim/quality';
import { fryWindow, takeBasket } from '../../game/sim/stations/fryer';
import { ITEMS } from '../../game/data/recipes';
import type { DaySim } from '../../game/sim/day';
import { consumeIngredient, stockQty } from '../../game/sim/stock';
import type { DayConfig, TachoConfig } from '../../game/types';
import { devConfig } from '../testConfig';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';

const secs = (n: number): number => Math.round(n / STEP);
const tacho = (extra: Partial<TachoConfig> = {}): TachoConfig => ({ baskets: 2, oil: 'comum', thermostat: false, alarm: false, timer: false, ...extra });

const withEquip = (equipment: Partial<DayConfig['equipment']> = {}, patch: Partial<DayConfig> = {}): DayConfig => {
  const base = devConfig();
  return { ...base, equipment: { ...base.equipment, ...equipment }, ...patch };
};

function fryerSim(seed: number, config: DayConfig, items: string[] = ['carne']): DaySim {
  const sim = makeSim(seed, config);
  sim.state.arrivalLeft = 1e9;
  items.forEach((item, i) => sim.state.assembled.push({ id: 100 + i, item }));
  sim.dispatch({ type: 'tapStation', station: 'tacho1' });
  advance(sim, secs(1));
  return sim;
}

const tap = (sim: DaySim, index: number, station: 'tacho1' | 'tacho2' = 'tacho1') => {
  sim.dispatch({ type: 'tapSlot', station, slot: { k: 'cesto', index } });
  sim.step();
};

export const equipamentos: Scenario[] = [
  {
    id: 'tacho-grande-4-cestos',
    rules: 'RN-73',
    run(seed) {
      const sim = fryerSim(seed, withEquip({}, { tachos: [tacho({ baskets: 4 })] }), ['carne', 'carne', 'carne', 'carne', 'carne']);
      checkEq(sim.state.tachos[0].baskets.length, 4, 'cestos');
      for (let i = 0; i < 4; i++) tap(sim, i);
      checkEq(sim.state.assembled.length, 1, 'quatro pastéis fritando ao mesmo tempo');
    },
  },
  {
    id: 'tacho-extra-na-ordem-da-barraca',
    rules: 'RN-73',
    run(seed) {
      const cfg = withEquip({}, { stations: ['balcao', 'bancada', 'tacho1', 'tacho2', 'moenda'], tachos: [tacho(), tacho()] });
      const sim = makeSim(seed, cfg);
      sim.state.arrivalLeft = 1e9;
      sim.state.assembled.push({ id: 1, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho2' });
      advance(sim, secs(2));
      tap(sim, 0, 'tacho2');
      check(sim.state.tachos[1].baskets[0].frying !== null, 'o segundo tacho frita');
      checkEq(sim.state.tachos[0].baskets[0].frying, null, 'e o primeiro fica livre');
    },
  },
  {
    id: 'termostato-janela-e-queima',
    rules: 'RN-73',
    run(seed) {
      const run = (seconds: number) => {
        const sim = fryerSim(seed, withEquip({}, { tachos: [tacho({ thermostat: true })] }));
        tap(sim, 0);
        advance(sim, secs(seconds));
        tap(sim, 0);
        return sim;
      };
      checkEq(run(9.4).state.ready[0].quality, 80, 'no ponto até 9,5 s');
      checkEq(run(9.6).state.ready[0].quality, 55, 'passado depois de 9,5 s');
      checkEq(run(5.1).state.ready[0].quality, 80, 'ponto começa aos 5 s');
      const q = run(13);
      checkEq(q.state.ready.length, 0, 'queima aos 13 s');
      checkEq(q.state.stats.burned, 1, 'queimado');
      checkEq(run(12.5).state.ready[0].quality, 55, 'ainda não queimou aos 12,5 s');
    },
  },
  {
    id: 'alarme-do-ponto',
    rules: 'RN-73',
    run(seed) {
      const sim = fryerSim(seed, withEquip({}, { tachos: [tacho({ alarm: true })] }));
      tap(sim, 0);
      advance(sim, secs(4.9));
      check(!sim.drainEvents().some((e) => e.type === 'alarme_ponto'), 'sem alarme antes do ponto');
      advance(sim, secs(0.3));
      check(sim.drainEvents().some((e) => e.type === 'alarme_ponto'), 'alarme ao entrar no ponto (5 s)');
      advance(sim, secs(3.5));
      check(!sim.drainEvents().some((e) => e.type === 'alarme_queima'), 'sem alarme de queima ainda (8,7 s)');
      advance(sim, secs(0.5));
      check(sim.drainEvents().some((e) => e.type === 'alarme_queima'), 'alarme 1 s antes de queimar (9 s)');
      advance(sim, secs(3));
      check(!sim.drainEvents().some((e) => e.type === 'alarme_ponto' || e.type === 'alarme_queima'), 'cada alarme dispara uma vez');
      const mudo = fryerSim(seed, withEquip());
      tap(mudo, 0);
      advance(mudo, secs(9.5));
      check(!mudo.drainEvents().some((e) => e.type.startsWith('alarme')), 'sem o equipamento, sem alarme');
    },
  },
  {
    id: 'oleo-de-algodao',
    rules: 'RN-24, RN-46',
    run(seed) {
      const sim = fryerSim(seed, withEquip({}, { tachos: [tacho({ oil: 'algodao' })] }), ['carne', 'carne']);
      tap(sim, 0);
      checkNear(sim.state.tachos[0].dirt, 0.03, 'suja 3% por pastel');
      advance(sim, secs(6));
      tap(sim, 0);
      checkEq(sim.state.ready[0].quality, 90, 'nota +10');
      sim.dispatch({ type: 'holdStart', station: 'tacho1', action: 'oleo' });
      advance(sim, secs(8.2));
      checkEq(sim.state.stats.oilCost, 45, 'troca custa R$ 45');
    },
  },
  {
    id: 'escorredor-profissional',
    rules: 'RN-24',
    run(seed) {
      const sim = fryerSim(seed, withEquip({ drainer: true }));
      tap(sim, 0);
      advance(sim, secs(6));
      tap(sim, 0);
      checkEq(sim.state.ready[0].quality, 90, 'nota +10');
      const both = fryerSim(seed, withEquip({ drainer: true }, { tachos: [tacho({ oil: 'algodao' })] }));
      tap(both, 0);
      advance(both, secs(6));
      tap(both, 0);
      checkEq(both.state.ready[0].quality, 100, 'algodão + escorredor, limitado a 100');
    },
  },
  {
    id: 'rn27-estufa-no-balcao-recebe-o-pastel-frito',
    rules: 'RN-27, RN-96',
    run(seed) {
      // a estufa fica em cima do balcão: o pastel tirado do óleo vai direto para ela, até encher
      const fryOut = (sim: ReturnType<typeof makeSim>, n: number) => {
        const s = sim.state;
        const t = s.tachos[0];
        const win = fryWindow(ITEMS.carne, t);
        for (let i = 0; i < n; i++) {
          t.baskets[0].frying = { id: 100 + i, item: 'carne', ticks: secs((win.ponto[0] + win.ponto[1]) / 2), burned: false, pontoAlerted: false, burnAlerted: false };
          takeBasket(s, t, 0);
        }
      };
      const sim = makeSim(seed, withEquip({ warmer: 6 }));
      sim.state.arrivalLeft = 1e9;
      checkEq(sim.state.config.stations.includes('estufa' as never), false, 'a estufa não é estação: fica no balcão');
      fryOut(sim, 7);
      const s = sim.state;
      checkEq(s.ready.filter((r) => r.warmed).length, 6, 'a estufa guarda 6');
      checkEq(s.ready.filter((r) => !r.warmed).length, 1, 'o sétimo fica no balcão');
      const r = s.ready[0];
      const t0 = r.readyAt;
      checkEq(currentQuality(r, t0 + 59), 80, 'nota congelada por 60 s');
      checkEq(currentQuality(r, t0 + 70), 70, 'depois cai 1 ponto/s');
      const normal = { id: 9, item: 'carne', quality: 80, readyAt: t0 };
      checkEq(currentQuality(normal, t0 + DECAY_DELAY + 20), 80 - 20 * DECAY_PER_SECOND, 'sem estufa: perde a nota depois do atraso (RN-25)');
      // estufa grande: 12 vagas
      const big = makeSim(seed, withEquip({ warmer: 12 }));
      big.state.arrivalLeft = 1e9;
      fryOut(big, 13);
      checkEq(big.state.ready.filter((x) => x.warmed).length, 12, 'estufa grande guarda 12');
      // sem estufa, nada é guardado
      const none = makeSim(seed, withEquip({ warmer: 0 }));
      fryOut(none, 2);
      checkEq(none.state.ready.filter((x) => x.warmed).length, 0, 'sem estufa, o pastel fica no balcão');
    },
  },
  {
    id: 'rn27-rn152-sem-energia-o-pastel-frito-nao-entra-na-estufa',
    rules: 'RN-27, RN-152',
    run(seed) {
      const sim = makeSim(seed, withEquip({ warmer: 6 }));
      const s = sim.state;
      s.world.powerLeft = 10; // queda de energia em andamento
      const t = s.tachos[0];
      t.baskets[0].frying = { id: 1, item: 'carne', ticks: secs(6), burned: false, pontoAlerted: false, burnAlerted: false };
      takeBasket(s, t, 0);
      checkEq(s.ready[0].warmed ?? false, false, 'sem energia, a estufa não guarda');
    },
  },
  {
    id: 'moenda-motorizada-e-caldos',
    rules: 'RN-31, RN-42',
    run(seed) {
      const cfg = withEquip({ mill: 'motorizada' }, {
        menu: [{ item: 'carne', price: 7 }, { item: 'caldo-limao', price: 7 }],
        stock: [...devConfig().stock, { ingredient: 'limao', qty: 5, daysLeft: 1 }],
      });
      const sim = makeSim(seed, cfg);
      sim.state.arrivalLeft = 1e9;
      sim.dispatch({ type: 'tapStation', station: 'moenda' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda', item: 'caldo-limao' });
      advance(sim, secs(2.4));
      checkEq(sim.state.cups.length, 0, 'ainda não aos 2,4 s');
      advance(sim, secs(0.3));
      checkEq(sim.state.cups.length, 1, 'caldo em 2,5 s');
      checkEq(sim.state.cups[0].item, 'caldo-limao', 'caldo com limão');
      checkEq(stockQty(sim.state, 'limao'), 4, 'consumiu 1 limão');
      checkEq(stockQty(sim.state, 'cana'), 29, 'e 1 dose de cana');
    },
  },
  {
    id: 'rn30d-especial-ocupa-2-cestos',
    rules: 'RN-30d',
    run(seed) {
      const cfg = withEquip({}, { menu: [{ item: 'especial', price: 21 }, { item: 'carne', price: 7 }] });
      const small = fryerSim(seed, cfg, ['especial', 'carne']);
      tap(small, 0);
      check(small.state.tachos[0].baskets[0].frying !== null, 'Especial no cesto 1');
      checkEq(small.state.tachos[0].baskets[1].shadow, 0, 'ocupa também o cesto 2');
      checkEq(small.state.assembled.length, 1, 'o outro pastel espera: num tacho pequeno o Especial ocupa o tacho inteiro');
      advance(small, secs(11));
      tap(small, 1); // tirar pelo cesto parceiro
      checkEq(small.state.ready.length, 1, 'tirou o Especial pelo cesto 2');
      check(small.state.tachos[0].baskets.every((b) => b.frying === null && b.shadow === null), 'os dois cestos liberam');
      checkEq(small.state.ready[0].quality, 80, 'Especial no ponto aos 11 s (janela 10–12)');
      // tacho grande: Especial + 2 pastéis; o 3º pastel não entra
      const big = fryerSim(seed, withEquip({}, { tachos: [tacho({ baskets: 4 })], menu: cfg.menu }), ['especial', 'carne', 'carne', 'carne']);
      tap(big, 0);
      tap(big, 2);
      tap(big, 3);
      tap(big, 1); // cesto 2 é parceiro do Especial: toque tira o Especial (cru), não coloca
      checkEq(big.state.ready.length, 1, 'tocar o cesto parceiro tira o Especial');
    },
  },
  {
    id: 'especial-queima-os-dois-cestos',
    rules: 'RN-30d, RN-23',
    run(seed) {
      const sim = fryerSim(seed, withEquip({}, { menu: [{ item: 'especial', price: 21 }] }), ['especial']);
      tap(sim, 0);
      advance(sim, secs(13.2));
      check(sim.state.tachos[0].baskets[0].frying!.burned, 'queimou aos 13 s');
      check(sim.state.tachos[0].baskets[1].shadow === 0, 'o parceiro continua bloqueado');
      tap(sim, 1);
      checkEq(sim.state.stats.burned, 1, 'descartado uma vez');
      check(sim.state.tachos[0].baskets.every((b) => b.shadow === null), 'liberou os dois');
    },
  },
  {
    id: 'rn30e-doce-como-sobremesa',
    rules: 'RN-30e, D-08',
    run(seed) {
      const cfg = devConfig({
        menu: [{ item: 'carne', price: 6 }, { item: 'banana-canela', price: 6 }],
        stock: [
          { ingredient: 'massa', qty: 9999, daysLeft: 3 },
          { ingredient: 'carne', qty: 9999, daysLeft: 1 },
          { ingredient: 'banana', qty: 9999, daysLeft: 1 },
          { ingredient: 'acucar-canela', qty: 9999, daysLeft: 1 },
        ],
      });
      const rate = (hourTick: number) => {
        const sim = makeSim(seed + hourTick, cfg);
        const s = sim.state;
        s.tick = hourTick;
        let doces = 0;
        const N = 5000;
        for (let i = 0; i < N; i++) {
          s.customers.length = 0;
          spawnCustomer(s);
          const c = s.customers[0];
          if (c) {
            check(c.lines.some((l) => l.item === 'carne'), 'o doce não substitui o salgado');
            if (c.lines.some((l) => l.item === 'banana-canela')) doces++;
          }
        }
        return doces / N;
      };
      check(Math.abs(rate(60 * 20) - 0.25) < 0.03, `25% de manhã (${rate(60 * 20)})`);
      check(Math.abs(rate(60 * 200) - 0.35) < 0.03, `35% depois das 11h (${rate(60 * 200)})`);
    },
  },
  {
    id: 'doce-sem-insumo-e-troca',
    rules: 'RN-30e, RN-35',
    run(seed) {
      const cfg = devConfig({
        menu: [{ item: 'banana-canela', price: 6 }, { item: 'doce-de-leite', price: 6 }],
        stock: [
          { ingredient: 'massa', qty: 20, daysLeft: 3 },
          { ingredient: 'banana', qty: 5, daysLeft: 1 },
          { ingredient: 'acucar-canela', qty: 5, daysLeft: 1 },
          { ingredient: 'doce-de-leite', qty: 5, daysLeft: 1 },
        ],
      });
      const sim = makeSim(seed, cfg);
      const s = sim.state;
      s.arrivalLeft = 1e9;
      const c = addCustomer(s, 'padrao', ['banana-canela']);
      consumeIngredient(s, 'banana', 5);
      // a troca por sabor da mesma categoria (doce) vale também para sobremesa
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'bancada', slot: { k: 'ingrediente', id: 'banana' } });
      sim.step();
      checkEq(c.lines[0].item, 'doce-de-leite', 'troca para outro doce de preço igual');
    },
  },
];
