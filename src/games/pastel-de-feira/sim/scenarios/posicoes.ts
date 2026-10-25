import { STEP } from '../../game/constants';
import { crewSpeed, flavorFor, fryerTachos, homeStation, speedFactor, workerStation } from '../../game/sim/staff';
import { ITEMS } from '../../game/data/recipes';
import { fryWindow } from '../../game/sim/stations/fryer';
import { addCustomer } from '../../game/sim/customers';
import type { DaySim } from '../../game/sim/day';
import type { Customer, DayState } from '../../game/sim/state';
import type { PositionId, StaffKind, TraitId, CourseId } from '../../game/data/staff';
import type { DayConfig, StaffConfig } from '../../game/types';
import { devConfig } from '../testConfig';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';

const secs = (n: number): number => Math.round(n / STEP);

let nextId = 1;
export function member(kind: StaffKind, extra: Partial<StaffConfig> = {}, traits: TraitId[] = [], courses: CourseId[] = []): StaffConfig {
  return { id: nextId++, name: `F${nextId}`, kind, traits, courses, mode: 'auto', position: null, ...extra };
}

/** Barraca com equipe; o pasteleiro fica no escritório, sem tomar o lugar de ninguém. */
export function crewSim(seed: number, staff: StaffConfig[], patch: Partial<DayConfig> = {}): DaySim {
  const cfg = devConfig({ staff, stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'escritorio'], ...patch });
  const sim = makeSim(seed, cfg);
  sim.state.arrivalLeft = 1e9;
  sim.state.pasteleiro.at = 'escritorio';
  return sim;
}

const pos = (s: DayState, id: number): PositionId | null => s.workers.find((w) => w.id === id)!.position;

/** Cliente já anotado com o pedido dado. */
function ordered(s: DayState, items: string[]): Customer {
  const c = addCustomer(s, 'padrao', items);
  c.state = 'anotado';
  return c;
}

export const posicoes: Scenario[] = [
  {
    id: 'rn45-prioridade-do-automatico',
    rules: 'RN-45, RN-49',
    run(seed) {
      const f = member('fritador');
      const g1 = member('geral');
      const g2 = member('geral');
      const g3 = member('geral');
      const g4 = member('geral');
      const sim = crewSim(seed, [g1, f, g2, g3, g4]);
      sim.step();
      const s = sim.state;
      checkEq(pos(s, f.id), 'fritador1', 'Fritador > Balcão > Montagem > Moenda');
      checkEq(pos(s, g1.id), 'balcao', 'primeiro Geral no Balcão');
      checkEq(pos(s, g2.id), 'montagem1', 'segundo na Montagem');
      checkEq(pos(s, g3.id), 'moenda', 'terceiro na Moenda');
      checkEq(pos(s, g4.id), null, 'o quarto Geral fica ocioso: Trocador é só de Fritador');
    },
  },
  {
    id: 'rn49-geral-nao-frita',
    rules: 'RN-49, PA-03',
    run(seed) {
      const sim = crewSim(seed, [member('geral'), member('geral'), member('geral'), member('geral')]);
      sim.step();
      check(sim.state.workers.every((w) => w.position !== 'fritador1' && w.position !== 'trocador'), 'Geral nunca ocupa Fritador nem Trocador');
      const fixo = member('geral', { mode: 'fixo', position: 'fritador1' });
      const sim2 = crewSim(seed, [fixo]);
      sim2.step();
      checkEq(sim2.state.workers[0].position, null, 'fixo inelegível não assume a posição');
    },
  },
  {
    id: 'rn45-fixo-fica-na-posicao',
    rules: 'RN-45',
    run(seed) {
      const g = member('geral', { mode: 'fixo', position: 'moenda' });
      const sim = crewSim(seed, [g]);
      sim.step();
      checkEq(pos(sim.state, g.id), 'moenda', 'fixo na Moenda mesmo havendo posições de maior prioridade');
    },
  },
  {
    id: 'ja01-pasteleiro-assume-a-funcao',
    rules: 'JA-01',
    run(seed) {
      const auto = member('geral');
      const fixo = member('geral', { mode: 'fixo', position: 'balcao' });
      const sim = crewSim(seed, [auto, fixo]);
      sim.step();
      checkEq(pos(sim.state, fixo.id), 'balcao', 'fixo no balcão');
      checkEq(pos(sim.state, auto.id), 'montagem1', 'automático na Montagem');
      sim.dispatch({ type: 'tapStation', station: 'balcao' });
      advance(sim, secs(3));
      checkEq(pos(sim.state, fixo.id), null, 'o fixo espera ao lado enquanto o pasteleiro está no balcão');
      checkEq(pos(sim.state, auto.id), 'montagem1', 'o automático segue onde estava');
      // pasteleiro vai para a bancada: toma a Montagem; o automático realoca para a posição vaga de maior prioridade
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, secs(3));
      checkEq(pos(sim.state, fixo.id), 'balcao', 'o fixo volta quando o balcão libera');
      checkEq(pos(sim.state, auto.id), 'moenda', 'o automático realoca para outra posição vaga (Moenda)');
      checkEq(homeStation('montagem1'), 'bancada', 'a Montagem mora na bancada');
    },
  },
  {
    id: 'rn43-atendimento-sem-pasteleiro',
    rules: 'RN-43, RN-40',
    run(seed) {
      const sim = crewSim(seed, [member('fritador'), member('geral'), member('geral'), member('geral')]);
      sim.state.arrivalLeft = 2;
      advance(sim, secs(240));
      const r = sim.result()!;
      check(r.orders.served >= 8, `a equipe atende sozinha (${r.orders.served} pedidos)`);
      check(r.waste.burned <= 2, `queimados só quando a equipe toda cansa e descansa junta (${r.waste.burned})`);
      check(r.revenue.total > 0, 'cobrou');
      check(r.reputation.successes >= 6, `sucessos ${r.reputation.successes}`);
    },
  },
  {
    id: 'rn43-fritador-tira-no-meio-da-janela',
    rules: 'RN-43',
    run(seed) {
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' })]);
      const s = sim.state;
      s.assembled.push({ id: 100, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.dispatch({ type: 'tapStation', station: 'escritorio' });
      advance(sim, secs(2));
      check(s.tachos[0].baskets[0].frying !== null, 'pastel fritando');
      advance(sim, secs(4.4));
      checkEq(s.ready.length, 0, 'ainda não passou do meio da janela (6,5 s)');
      advance(sim, secs(1));
      checkEq(s.ready.length, 1, 'tirou no meio da janela');
      checkEq(s.ready[0].quality, 80, 'no ponto');
      advance(sim, secs(20));
      checkEq(s.stats.burned, 0, 'nunca queima');
    },
  },
  {
    id: 'rn45-fritador-e-troca-de-oleo-trocam-o-oleo',
    rules: 'RN-45, RN-46',
    run(seed) {
      // um Fritador automático vai para o tacho (maior prioridade) e troca o óleo do tacho dele
      const one = crewSim(seed, [member('fritador')]);
      one.state.tachos[0].dirt = 0.72;
      advance(one, secs(3));
      checkEq(one.state.workers[0].position, 'fritador1', 'automático no Fritador');
      checkEq(one.state.tachos[0].changeBy, one.state.workers[0].id, 'o Fritador troca o óleo do tacho dele');
      // com Fritador, Balcão e Montagem ocupados, o segundo Fritador automático vai para a Troca de óleo e troca
      const sim = crewSim(seed, [member('fritador'), member('geral'), member('geral'), member('fritador')]);
      const s = sim.state;
      advance(sim, 2);
      checkEq(s.workers.map((w) => w.position).join(','), 'fritador1,balcao,montagem1,trocador', 'prioridade: Fritador > Balcão > Montagem > Troca de óleo');
      check(s.tachos[0].changeProgress === 0, 'sem óleo sujo, ninguém troca');
      s.tachos[0].dirt = 0.72;
      advance(sim, secs(2));
      check(s.tachos[0].changeProgress > 0, 'o óleo começou a ser trocado');
      check([s.workers[0].id, s.workers[3].id].includes(s.tachos[0].changeBy), 'quem troca é o Fritador do tacho ou a Troca de óleo');
      advance(sim, secs(9));
      checkEq(s.tachos[0].dirt, 0, 'óleo limpo depois de 10 s');
      checkEq(s.stats.oilCost, 25, 'custo R$ 25');
    },
  },
  {
    id: 'trocador-e-posicao-propria',
    rules: 'RN-40',
    run(seed) {
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'trocador' })]);
      const s = sim.state;
      s.tachos[0].dirt = 0.9;
      advance(sim, secs(1));
      check(s.tachos[0].changeProgress > 0, 'o Trocador atende o tacho sujo');
    },
  },
  {
    id: 'rn114-rapido-e-atendimento',
    rules: 'RN-114, RN-118',
    run(seed) {
      const rapid = member('geral', { mode: 'fixo', position: 'montagem1' }, ['rapido']);
      const sim = crewSim(seed, [rapid]);
      const s = sim.state;
      ordered(s, ['carne']);
      advance(sim, 2);
      checkNear(s.workers[0].task!.total, ((0.5 + 1.5) * 0.85) / crewSpeed(s), 'montagem de 1 etapa com Rápido: 1,7 s (÷ bônus do escritório)', 1e-6);
      checkNear(speedFactor(s.workers[0]), 0.85, 'fator');
      const att = member('geral', { mode: 'fixo', position: 'balcao' }, [], ['atendimento']);
      const sim2 = crewSim(seed, [att]);
      const c = addCustomer(sim2.state, 'padrao', ['carne']);
      const antes = c.patienceMax;
      advance(sim2, 2);
      checkNear(sim2.state.workers[0].task!.total, (1.5 * 0.8) / crewSpeed(sim2.state), 'anotar com Atendimento: 1,2 s (÷ bônus do escritório)');
      advance(sim2, secs(1.5));
      checkEq(c.state, 'anotado', 'anotou');
      checkNear(c.patienceMax, antes * 1.05, 'cliente atendido com +5% de paciência');
    },
  },
  {
    id: 'rn114-caprichoso-e-curso-de-fritura',
    rules: 'RN-114, RN-118',
    run(seed) {
      const cap = member('geral', { mode: 'fixo', position: 'montagem1' }, ['caprichoso']);
      const fry = member('fritador', { mode: 'fixo', position: 'fritador1' }, [], ['fritura']);
      const sim = crewSim(seed, [cap, fry]);
      const s = sim.state;
      ordered(s, ['carne']);
      advance(sim, secs(40));
      check(s.ready.length >= 1, 'um pastel pronto');
      const q = s.ready[0].quality;
      checkEq(q, 90, 'no ponto 80 + Caprichoso 5 (montou) + Fritura 5 (fritou)');
    },
  },
  {
    id: 'rn114-distraido-erra-5-por-cento',
    rules: 'RN-114',
    run(seed) {
      const d = member('geral', {}, ['distraido']);
      const sim = crewSim(seed, [d]);
      const s = sim.state;
      let wrong = 0;
      const N = 5000;
      for (let i = 0; i < N; i++) if (flavorFor(s, s.workers[0], 'carne') !== 'carne') wrong++;
      check(Math.abs(wrong / N - 0.05) < 0.015, `erra ${wrong / N}`);
      const normal = crewSim(seed, [member('geral')]);
      check(flavorFor(normal.state, normal.state.workers[0], 'carne') === 'carne', 'sem o traço, nunca erra');
    },
  },
  {
    id: 'fritador-poe-na-estufa',
    rules: 'RN-40, RN-27',
    run(seed) {
      const base = devConfig();
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' })], { equipment: { ...base.equipment, warmer: 6 } });
      const s = sim.state;
      s.assembled.push({ id: 100, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.dispatch({ type: 'tapStation', station: 'escritorio' });
      advance(sim, secs(9));
      checkEq(s.ready.length, 1, 'pronto');
      check(s.ready[0].warmed === true, 'guardado na estufa');
    },
  },
  {
    id: 'rn44-fritador-cuida-do-tacho-e-nao-monta',
    rules: 'RN-44',
    run(seed) {
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' })]);
      const s = sim.state;
      const w = s.workers[0];
      const c = addCustomer(s, 'padrao', ['carne']);
      c.state = 'anotado';
      advance(sim, secs(5));
      checkEq(s.assembled.length, 0, 'sem Montagem, ninguém monta: o Fritador não monta');
      check(w.task?.kind !== 'montar', 'o Fritador nunca pega a tarefa de montar');
      checkEq(workerStation(s, w), 'tacho1', 'fica no tacho');
      // pastel já montado: o Fritador coloca no tacho dele
      s.assembled.push({ id: 100, item: 'carne' });
      advance(sim, secs(1));
      checkEq(s.tachos[0].baskets[0].frying?.id, 100, 'o Fritador coloca o pastel montado');
      // óleo sujo no tacho dele: ele mesmo troca (sem ninguém na Troca de óleo)
      const win = fryWindow(ITEMS.carne, s.tachos[0]);
      advance(sim, secs(win.ponto[1] + 1));
      checkEq(s.ready.length, 1, 'tirou no ponto');
      s.tachos[0].dirt = 0.75;
      advance(sim, secs(1));
      checkEq(s.tachos[0].changeBy, w.id, 'o Fritador troca o óleo do tacho dele');
    },
  },
  {
    id: 'rn40-montagem-coloca-em-qualquer-tacho',
    rules: 'RN-40',
    run(seed) {
      const two = [{ baskets: 2, oil: 'comum' as const, thermostat: false, alarm: false, timer: false }, { baskets: 2, oil: 'comum' as const, thermostat: false, alarm: false, timer: false }];
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'montagem1' })], { stations: ['balcao', 'bancada', 'tacho1', 'tacho2', 'moenda', 'escritorio'], tachos: two });
      const s = sim.state;
      for (const b of s.tachos[0].baskets) b.frying = { id: 90 + s.tachos[0].baskets.indexOf(b), item: 'carne', ticks: 0, burned: false, pontoAlerted: false, burnAlerted: false };
      s.assembled.push({ id: 100, item: 'carne' });
      advance(sim, secs(1.2));
      checkEq(s.tachos[1].baskets[0].frying?.id, 100, 'tacho 1 cheio: a Montagem coloca no tacho 2');
      checkEq(homeStation('montagem1'), 'bancada', 'a Montagem fica na bancada');
    },
  },
  {
    id: 'rn40-fritadores-assumem-tachos-livres-em-ordem',
    rules: 'RN-40, JA-01',
    run(seed) {
      const two = [{ baskets: 2, oil: 'comum' as const, thermostat: false, alarm: false, timer: false }, { baskets: 2, oil: 'comum' as const, thermostat: false, alarm: false, timer: false }];
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' }), member('fritador', { mode: 'fixo', position: 'fritador2' })], {
        stations: ['balcao', 'bancada', 'tacho1', 'tacho2', 'moenda', 'escritorio'], tachos: two,
        positions: ['balcao', 'montagem1', 'montagem2', 'fritador1', 'fritador2', 'trocador', 'moenda'],
      });
      const s = sim.state;
      const [a, b] = s.workers;
      sim.step();
      checkEq([fryerTachos(s).get(a.id), fryerTachos(s).get(b.id)].join(','), '0,1', 'Fritador 1 no tacho 1, Fritador 2 no tacho 2');
      s.pasteleiro.at = 'tacho1';
      sim.step();
      checkEq(a.position, 'fritador1', 'o pasteleiro no tacho 1 não tira o Fritador da posição');
      checkEq(fryerTachos(s).get(a.id), 1, 'o Fritador 1 assume o tacho 2, o primeiro livre');
      checkEq(fryerTachos(s).get(b.id), undefined, 'o Fritador 2 fica sem tacho');
      checkEq(workerStation(s, a), 'tacho2', 'aparece no tacho 2');
    },
  },
];
