import { STEP } from '../../game/constants';
import { buyEquipment, buyTachoUpgrade } from '../../game/campaign/actions/upgrades';
import { addCustomer } from '../../game/sim/customers';
import { equipmentFlags, newCampaign } from '../../game/campaign/campaign';
import type { DaySim } from '../../game/sim/day';
import type { ActionResult, Campaign, Refusal } from '../../game/campaign/types';
import type { DayConfig, TachoConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { tableConfig } from './mesas';
import { crewSim, member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);
const timerTacho = (extra: Partial<TachoConfig> = {}): TachoConfig => ({ baskets: 2, oil: 'comum', thermostat: false, alarm: false, timer: true, ...extra });

function autoSim(seed: number, patch: Partial<DayConfig> = {}): DaySim {
  const base = devConfig();
  const sim = makeSim(seed, devConfig({ tachos: [timerTacho()], equipment: { ...base.equipment }, stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'escritorio'], ...patch }));
  sim.state.arrivalLeft = 1e9;
  sim.state.pasteleiro.at = 'escritorio';
  return sim;
}

const must = (r: ActionResult): Campaign => {
  check(r.ok, 'ação recusada');
  return r.campaign;
};
const refused = (r: ActionResult, motivo: Refusal, msg: string): void => {
  check(!r.ok, `${msg}: deveria recusar`);
  if (!r.ok) checkEq(r.motivo, motivo, msg);
};

const place = (sim: DaySim, n = 1) => {
  for (let i = 0; i < n; i++) sim.state.assembled.push({ id: 100 + i, item: 'carne', bonus: 5 });
  sim.dispatch({ type: 'tapStation', station: 'tacho1' });
  advance(sim, secs(1));
  for (let i = 0; i < n; i++) {
    sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: i } });
    sim.step();
  }
  sim.dispatch({ type: 'tapStation', station: 'escritorio' });
};

export const automacao: Scenario[] = [
  {
    id: 'rn162-timer-tira-no-meio-sem-bonus',
    rules: 'RN-160, RN-162',
    run(seed) {
      const sim = autoSim(seed);
      place(sim);
      advance(sim, secs(5));
      checkEq(sim.state.ready.length, 0, 'ainda antes do meio da janela (6,5 s)');
      advance(sim, secs(2));
      checkEq(sim.state.ready.length, 1, 'tirou no meio da janela');
      checkEq(sim.state.ready[0].quality, 80, 'nota 80: o bônus do Caprichoso não vale (RN-162)');
      check(!sim.state.ready[0].warmed, 'fica no escorredor, sem estufa');
      advance(sim, secs(30));
      checkEq(sim.state.stats.burned, 0, 'nunca queima com energia');
      const esc = autoSim(seed, { equipment: { ...devConfig().equipment, drainer: true } });
      place(esc);
      advance(esc, secs(8));
      checkEq(esc.state.ready[0].quality, 90, 'os modificadores do equipamento valem (escorredor +10)');
    },
  },
  {
    id: 'rn161-timer-nao-soma-com-o-fritador',
    rules: 'RN-161',
    run(seed) {
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1', }, [], ['fritura'])], { tachos: [timerTacho()] });
      sim.state.assembled.push({ id: 1, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.dispatch({ type: 'tapStation', station: 'escritorio' });
      advance(sim, secs(8));
      checkEq(sim.state.ready[0].quality, 80, 'o timer tirou (sem o +5 do curso do Fritador)');
      // o Fritador segue cuidando do tacho: coloca o pastel já montado
      sim.state.ready.length = 0;
      sim.state.assembled.push({ id: 2, item: 'carne' });
      advance(sim, secs(1));
      check(sim.state.tachos[0].baskets.some((b) => b.frying?.id === 2), 'o Fritador colocou o pastel montado');
    },
  },
  {
    id: 'timer-tira-mesmo-com-o-tacho-travado',
    rules: 'spec 4',
    run(seed) {
      const sim = autoSim(seed);
      sim.state.assembled.push({ id: 1, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.step();
      sim.state.tachos[0].dirt = 1; // travado em 100% depois de colocar
      advance(sim, secs(8));
      checkEq(sim.state.ready.length, 1, 'o timer tira no ponto mesmo com o tacho travado');
    },
  },
  {
    id: 'rn152-sem-energia-a-automacao-para',
    rules: 'RN-152, RN-160',
    run(seed) {
      const sim = autoSim(seed);
      place(sim);
      sim.state.world.powerLeft = 40;
      advance(sim, secs(12));
      checkEq(sim.state.ready.length, 0, 'sem energia o timer não tira');
      check(sim.state.tachos[0].baskets[0].frying?.burned === true, 'queima normal');
    },
  },
  {
    id: 'rn160-moenda-automatica-um-caldo-por-pedido',
    rules: 'RN-160',
    run(seed) {
      const base = devConfig();
      const sim = makeSim(seed, tableConfig(0, { equipment: { ...base.equipment, mill: 'motorizada', autoMill: true }, promo: { brindeN: 0, chorinho: 1, xepa: false, xepaDiscount: 0.3 } }));
      sim.state.arrivalLeft = 1e9;
      sim.state.pasteleiro.at = 'escritorio';
      advance(sim, secs(3));
      checkEq(sim.state.cups.length, 0, 'sem pedido de caldo, não faz');
      const c = addCustomer(sim.state, 'padrao', ['caldo-puro']);
      c.state = 'anotado';
      advance(sim, secs(2.7));
      checkEq(sim.state.cups.length, 0, 'extração leva 2,5 s + 0,3 s do chorinho');
      advance(sim, secs(0.3));
      checkEq(sim.state.cups.length, 1, 'um caldo por pedido anotado');
      advance(sim, secs(10));
      checkEq(sim.state.cups.length, 1, 'não faz caldo a mais do que o pedido');
    },
  },
  {
    id: 'rn160-moenda-automatica-para-sem-energia-e-substitui-a-posicao',
    rules: 'RN-160, RN-161',
    run(seed) {
      const base = devConfig();
      const sim = makeSim(seed, tableConfig(0, { equipment: { ...base.equipment, mill: 'motorizada', autoMill: true }, staff: [member('geral', { mode: 'fixo', position: 'moenda' })] }));
      sim.state.arrivalLeft = 1e9;
      sim.state.pasteleiro.at = 'escritorio';
      sim.step();
      const c = addCustomer(sim.state, 'padrao', ['caldo-puro']);
      c.state = 'anotado';
      advance(sim, 2);
      checkEq(sim.state.workers[0].task, null, 'com a moenda automática ativa o funcionário da Moenda não soma (RN-161)');
      advance(sim, secs(4));
      checkEq(sim.state.cups.length, 1, 'quem faz o caldo é a moenda automática');
      const sem = makeSim(seed, tableConfig(0, { equipment: { ...base.equipment, mill: 'motorizada', autoMill: true }, staff: [member('geral', { mode: 'fixo', position: 'moenda' })] }));
      sem.state.arrivalLeft = 1e9;
      sem.state.pasteleiro.at = 'escritorio';
      sem.step();
      const d = addCustomer(sem.state, 'padrao', ['caldo-puro']);
      d.state = 'anotado';
      sem.state.world.powerLeft = 20;
      advance(sem, 2);
      check(sem.state.workers[0].task !== null, 'sem energia a automação para e o funcionário volta a trabalhar');
    },
  },
  {
    id: 'rn87-maquininha-cobra-sozinha',
    rules: 'RN-160, RN-87',
    run(seed) {
      const base = devConfig();
      const sim = makeSim(seed, tableConfig(2, { equipment: { ...base.equipment, cardMachine: true } }));
      sim.state.arrivalLeft = 1e9;
      sim.state.pasteleiro.at = 'escritorio';
      sim.state.coins.push({ id: 1, amount: 12.5 });
      advance(sim, 2);
      checkEq(sim.state.coins.length, 0, 'moeda do balcão cobrada sem ninguém');
      checkNear(sim.state.stats.revenue, 12.5, 'receita');
      const g = addCustomer(sim.state, 'padrao', ['carne']);
      g.owed = 20;
      g.place = 'pagamento';
      g.timer = 20;
      sim.state.payQueue.push(g);
      advance(sim, 2);
      checkEq(sim.state.payQueue.length, 0, 'grupo da fila de pagamento cobrado sem ninguém no balcão');
      checkNear(sim.state.stats.tableRevenue, 20, 'receita de mesa');
      // sem energia, para
      sim.state.world.powerLeft = 30;
      sim.state.coins.push({ id: 2, amount: 5 });
      advance(sim, secs(5));
      checkEq(sim.state.coins.length, 1, 'sem energia a maquininha não cobra');
    },
  },
  {
    id: 'compras-de-automacao-e-requisitos',
    rules: 'RN-160',
    run() {
      const c: Campaign = { ...newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 2 }), cash: 20000 };
      const t = must(buyTachoUpgrade(c, 'timer', 0));
      checkEq(c.cash - t.cash, 600, 'timer R$ 600 por tacho');
      refused(buyTachoUpgrade(t, 'timer', 0), 'limite', 'já tem');
      refused(buyEquipment(c, 'moenda-automatica'), 'requer', 'moenda automática exige a motorizada');
      let x = must(buyEquipment(c, 'moenda-motorizada'));
      x = must(buyEquipment(x, 'moenda-automatica'));
      checkEq(c.cash - x.cash, 500 + 900, 'preços');
      x = must(buyEquipment(x, 'maquininha'));
      const f = equipmentFlags(x);
      check(f.autoMill && f.cardMachine && f.mill === 'motorizada', 'flags no DayConfig');
      refused(buyEquipment(x, 'maquininha'), 'limite', 'único');
      refused(buyEquipment({ ...c, cash: 100 }, 'maquininha'), 'semCaixa', 'sem caixa');
    },
  },
];
