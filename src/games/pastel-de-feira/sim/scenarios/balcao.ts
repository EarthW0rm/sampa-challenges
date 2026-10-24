import { STEP } from '../../game/constants';
import { devConfig } from '../testConfig';
import { addCustomer } from '../../game/sim/customers';
import { stockQty } from '../../game/sim/stock';
import type { Command, StationId } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import type { DaySim } from '../../game/sim/day';

const go = (sim: DaySim, station: StationId) => {
  sim.dispatch({ type: 'tapStation', station });
  advance(sim, Math.round(2 / STEP));
};
const slot = (sim: DaySim, station: StationId, s: Extract<Command, { type: 'tapSlot' }>['slot']) => {
  sim.dispatch({ type: 'tapSlot', station, slot: s });
  sim.step();
};

/** Sem chegadas aleatórias: o cenário controla os clientes. */
const quiet = (seed: number, config = devConfig()) => {
  const sim = makeSim(seed, config);
  sim.state.arrivalLeft = 1e9;
  return sim;
};

export const balcao: Scenario[] = [
  {
    id: 'rn41-deslocamento',
    rules: 'RN-41',
    run(seed) {
      const sim = quiet(seed);
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      sim.step();
      checkNear(sim.state.pasteleiro.moveLeft, 0.4 - STEP, 'vizinha: 0,4 s', 1e-9);
      advance(sim, 30);
      checkEq(sim.state.pasteleiro.at, 'bancada', 'chegou na bancada');
      // duas estações de distância: 0,6 s
      const b = quiet(seed);
      b.dispatch({ type: 'tapStation', station: 'tacho1' });
      b.step();
      checkNear(b.state.pasteleiro.moveLeft, 0.6 - STEP, 'duas estações: 0,6 s', 1e-9);
    },
  },
  {
    id: 'rn41-ultimo-clique-vale',
    rules: 'RN-41, spec 4',
    run(seed) {
      const sim = quiet(seed);
      sim.dispatch({ type: 'tapStation', station: 'moenda' });
      advance(sim, 10);
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, 60);
      checkEq(sim.state.pasteleiro.at, 'bancada', 'destino substituído pelo último clique');
      checkEq(sim.state.pasteleiro.to, null, 'sem fila de ações');
    },
  },
  {
    id: 'acao-fora-da-estacao',
    rules: 'RN-42, spec 4',
    run(seed) {
      const sim = quiet(seed);
      addCustomer(sim.state, 'padrao', ['queijo']);
      slot(sim, 'balcao', { k: 'anotar' }); // começa no balcão
      checkEq(sim.state.customers[0].state, 'anotado', 'anotar no balcão');
      const antes = sim.state.rejected;
      slot(sim, 'bancada', { k: 'ingrediente', id: 'mucarela' });
      checkEq(sim.state.rejected, antes + 1, 'ingrediente fora da bancada é descartado');
      checkEq(sim.state.tray.length, 0, 'bandeja vazia');
    },
  },
  {
    id: 'pedido-completo-de-queijo',
    rules: 'RN-42, RN-20, RN-61',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['queijo']);
      slot(sim, 'balcao', { k: 'anotar' });
      go(sim, 'bancada');
      slot(sim, 'bancada', { k: 'ingrediente', id: 'mucarela' });
      slot(sim, 'bancada', { k: 'fechar' });
      checkEq(s.assembled.length, 1, 'pastel montado');
      checkEq(s.assembled[0].item, 'queijo', 'reconheceu a receita');
      checkEq(stockQty(s, 'massa'), 79, 'consumiu 1 massa');
      checkEq(stockQty(s, 'oregano'), 39, 'consumiu o tempero');
      // fritura simulada (TF-110-07): o pastel sai no ponto e chega ao balcão
      s.ready.push({ id: 500, item: 'queijo', quality: 80, readyAt: s.tick * STEP });
      go(sim, 'balcao');
      sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: 500 }, customerId: c.id });
      sim.step();
      checkEq(s.customers.length, 0, 'cliente saiu');
      checkEq(s.coins.length, 1, 'moeda no balcão');
      checkNear(s.coins[0].amount, 7 * (0.8 + 0.4 * 0.8), 'valor = preço × fator de qualidade (nota 80)');
      checkEq(s.rep.successes, 1, 'sucesso registrado');
      checkEq(s.consumables.saquinho, 99, 'saquinho consumido');
      slot(sim, 'balcao', { k: 'moedas' });
      checkNear(s.stats.revenue, 7.84, 'receita cobrada');
      checkEq(s.coins.length, 0, 'moeda recolhida');
    },
  },
  {
    id: 'rn63-item-errado-uma-vez',
    rules: 'RN-63',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne']);
      slot(sim, 'balcao', { k: 'anotar' });
      s.ready.push({ id: 1, item: 'queijo', quality: 80, readyAt: 0 });
      for (let i = 0; i < 3; i++) {
        sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: 1 }, customerId: c.id });
        sim.step();
      }
      checkEq(s.ready.length, 1, 'o item volta para a bancada');
      checkEq(s.stats.wrong, 1, 'um erro por pedido');
      checkNear(s.rep.failures, 1, 'falha de peso 1,0 uma vez só');
      // depois entrega certo: o pedido continua marcado como falha, sem sucesso
      s.ready.push({ id: 2, item: 'carne', quality: 80, readyAt: 0 });
      sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: 2 }, customerId: c.id });
      sim.step();
      checkEq(s.rep.successes, 0, 'sem sucesso depois de errar');
      checkNear(s.rep.failures, 1, 'sem falha em dobro');
      checkEq(s.coins.length, 1, 'mas é pago');
    },
  },
  {
    id: 'entrega-so-para-quem-anotou',
    rules: 'spec 4',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne']);
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: 0 });
      sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: 1 }, customerId: c.id });
      sim.step();
      checkEq(s.rejected, 1, 'cliente ainda não anotado: descartado');
      checkEq(s.ready.length, 1, 'item continua pronto');
    },
  },
  {
    id: 'rn34-massa-mais-antiga-primeiro',
    rules: 'RN-34',
    run(seed) {
      const config = devConfig({
        stock: [
          { ingredient: 'massa', qty: 5, daysLeft: 3 },
          { ingredient: 'massa', qty: 1, daysLeft: 1 },
          { ingredient: 'carne', qty: 5, daysLeft: 1 },
        ],
      });
      const sim = quiet(seed, config);
      go(sim, 'bancada');
      slot(sim, 'bancada', { k: 'ingrediente', id: 'carne' });
      slot(sim, 'bancada', { k: 'fechar' });
      const velho = sim.state.stock.find((l) => l.ingredient === 'massa' && l.daysLeft === 1)!;
      checkEq(velho.qty, 0, 'consumiu a massa mais antiga');
      checkEq(sim.state.stock.find((l) => l.ingredient === 'massa' && l.daysLeft === 3)!.qty, 5, 'a nova ficou');
    },
  },
  {
    id: 'cobranca-em-gesto-duplo',
    rules: 'spec 4',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      s.coins.push({ id: 1, amount: 10 });
      const cmd: Command = { type: 'tapSlot', station: 'balcao', slot: { k: 'moedas' }, g: 99 };
      sim.dispatch(cmd);
      sim.dispatch(cmd);
      sim.dispatch(cmd);
      sim.step();
      checkNear(s.stats.revenue, 10, 'um pagamento só');
      checkEq(s.rejected, 0, 'gesto repetido é ignorado, não rejeitado');
    },
  },
  {
    id: 'montagem-sem-estoque',
    rules: 'RN-35',
    run(seed) {
      const config = devConfig({ stock: [{ ingredient: 'massa', qty: 5, daysLeft: 3 }] });
      const sim = quiet(seed, config);
      go(sim, 'bancada');
      slot(sim, 'bancada', { k: 'ingrediente', id: 'carne' });
      check(sim.state.tray.length === 0, 'ingrediente sem estoque é descartado');
      slot(sim, 'bancada', { k: 'ingrediente', id: 'massa' });
      checkEq(sim.state.tray.length, 0, 'massa não é clicada: entra sozinha ao fechar');
    },
  },
];
