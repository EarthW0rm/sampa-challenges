import { STEP } from '../../game/constants';
import { buyRestArea, buyRestSlot, buySpace } from '../../game/campaign/actions/upgrades';
import { newCampaign } from '../../game/campaign/campaign';
import { speedFactor } from '../../game/sim/staff';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import { advance, check, checkEq, checkNear, type Scenario } from '../harness';
import { crewSim, member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

function must(r: ActionResult): Campaign {
  check(r.ok, 'ação recusada');
  return r.campaign;
}

export const energia: Scenario[] = [
  {
    id: 'rn115-energia-cai-0-5-por-segundo',
    rules: 'RN-115',
    run(seed) {
      const w = member('geral', { mode: 'fixo', position: 'balcao' });
      const sim = crewSim(seed, [w]);
      advance(sim, secs(100));
      checkNear(sim.state.workers[0].energy, 50, 'após 100 s trabalhando: 50', 0.05);
    },
  },
  {
    id: 'rn115-penalidades-de-energia',
    rules: 'RN-115',
    run(seed) {
      const sim = crewSim(seed, [member('geral')]);
      const w = sim.state.workers[0];
      w.energy = 80;
      checkEq(speedFactor(w), 1, 'descansado');
      w.energy = 39;
      checkNear(speedFactor(w), 1.25, 'abaixo de 40: +25%');
      w.energy = 14;
      checkNear(speedFactor(w), 1.6, 'abaixo de 15: +60%');
      w.traits = ['rapido'];
      checkNear(speedFactor(w), 1.6 * 0.85, 'traços e cansaço se combinam');
    },
  },
  {
    id: 'rn114-resistente-cansa-40-menos',
    rules: 'RN-114',
    run(seed) {
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' }, ['resistente'])]);
      advance(sim, secs(100));
      checkNear(sim.state.workers[0].energy, 100 - 0.5 * 0.6 * 100, 'Resistente: 70', 0.05);
    },
  },
  {
    id: 'rn116-automatico-descansa-sozinho-sem-area',
    rules: 'RN-116, JA-10',
    run(seed) {
      const sim = crewSim(seed, [member('geral')]);
      const w = sim.state.workers[0];
      advance(sim, secs(149));
      check(w.resting === null && w.position !== null, 'ainda trabalha aos 149 s');
      advance(sim, secs(3));
      check(w.resting === 'lugar', 'desce de 25 e descansa no lugar (sem área)');
      checkEq(w.position, null, 'deixa a posição vaga');
      const e0 = w.energy;
      advance(sim, secs(10));
      checkNear(w.energy - e0, 10, 'recupera 1 por segundo no lugar', 0.1);
      advance(sim, secs(50));
      check(w.resting === null, 'volta ao chegar em 80');
      check(w.position !== null, 'reassume uma posição');
    },
  },
  {
    id: 'rn117-area-recupera-4-por-segundo',
    rules: 'RN-116, RN-117',
    run(seed) {
      const sim = crewSim(seed, [member('geral')], { restSlots: 2 });
      const w = sim.state.workers[0];
      advance(sim, secs(152));
      check(w.resting === 'area', 'descansa na área');
      const t0 = sim.state.tick;
      const e0 = w.energy;
      while (w.resting && sim.state.tick - t0 < secs(60)) advance(sim, 1);
      const took = (sim.state.tick - t0) * STEP;
      checkNear(took, (80 - e0) / 4, 'recupera 4 por segundo até 80', 0.1);
      check(e0 < 36 && e0 > 24, 'o descanso começa perto de 25 (de 25 a 80 leva ~14 s)');
    },
  },
  {
    id: 'rn117-area-cheia-descansa-no-lugar',
    rules: 'RN-117, spec 4',
    run(seed) {
      const crew = [member('geral'), member('geral'), member('geral')];
      const sim = crewSim(seed, crew, { restSlots: 2 });
      sim.state.workers.forEach((w) => (w.energy = 20));
      advance(sim, 2);
      const kinds = sim.state.workers.map((w) => w.resting).sort();
      checkEq(kinds.join(','), 'area,area,lugar', 'duas vagas na área; o terceiro descansa no lugar');
    },
  },
  {
    id: 'ja10-posicao-fica-vaga-e-outro-assume',
    rules: 'JA-10, RN-45',
    run(seed) {
      const a = member('geral');
      const b = member('geral');
      const c = member('geral');
      const d = member('geral');
      const sim = crewSim(seed, [a, b, c, d]);
      sim.step();
      checkEq(sim.state.workers.find((w) => w.id === d.id)!.position, null, 'o quarto Geral começa ocioso');
      sim.state.workers[0].energy = 20; // quem está no balcão cansa
      advance(sim, 2);
      checkEq(sim.state.workers[0].resting === 'lugar', true, 'foi descansar');
      checkEq(sim.state.workers.find((w) => w.id === d.id)!.position, 'balcao', 'o ocioso assume a posição vaga de maior prioridade');
    },
  },
  {
    id: 'rn116-fixo-so-descansa-se-mandarem',
    rules: 'RN-116',
    run(seed) {
      const w = member('geral', { mode: 'fixo', position: 'balcao' });
      const sim = crewSim(seed, [w]);
      sim.state.workers[0].energy = 10;
      advance(sim, 10);
      checkEq(sim.state.workers[0].resting, null, 'fixo não descansa por conta própria com energia baixa');
      sim.dispatch({ type: 'sendRest', staffId: w.id });
      advance(sim, 2);
      check(sim.state.workers[0].resting !== null, 'mandado, vai descansar');
      checkEq(sim.state.workers[0].position, null, 'deixa a posição');
      const auto = member('geral');
      const sim2 = crewSim(seed, [auto]);
      sim2.dispatch({ type: 'sendRest', staffId: auto.id });
      advance(sim2, 2);
      checkEq(sim2.state.workers[0].resting, null, 'sendRest não vale para automático');
      checkEq(sim2.state.rejected, 1, 'comando descartado');
    },
  },
  {
    id: 'rn116-fixo-com-energia-zero-descansa',
    rules: 'RN-116',
    run(seed) {
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })]);
      sim.state.workers[0].energy = 0.2;
      advance(sim, secs(1));
      check(sim.state.workers[0].resting !== null, 'em zero, descansa');
    },
  },
  {
    id: 'ocioso-recupera-1-por-segundo',
    rules: 'spec 4',
    run(seed) {
      const g = [member('geral'), member('geral'), member('geral'), member('geral')];
      const sim = crewSim(seed, g);
      sim.step();
      const idle = sim.state.workers[3];
      idle.energy = 50;
      advance(sim, secs(20));
      checkNear(idle.energy, 70, 'ocioso recupera 1 por segundo', 0.2);
      check(idle.idleSeconds >= 20, 'tempo ocioso contabilizado');
      sim.state.workers[3].energy = 100;
      advance(sim, secs(220));
      const r = sim.result()!;
      check(r.staff.length === 4, 'resultado traz a equipe');
      check(r.staff[3].idleSeconds > 0, 'ociosidade no fechamento');
    },
  },
  {
    id: 'rn117-compra-da-area',
    rules: 'RN-117',
    run() {
      let c: Campaign = { ...newCampaign({ profile: 'negociante', eventsOn: false, tutorial: false, seed: 3 }), cash: 5000 };
      const r0 = buyRestArea(c);
      check(!r0.ok && r0.motivo === 'semEspaco', 'sem 1 m² livre');
      c = must(buySpace(c, 1));
      c = must(buyRestArea(c));
      checkEq(c.owned.rest, 2, '2 vagas');
      const again = buyRestArea(c);
      check(!again.ok && again.motivo === 'limite', 'área já comprada');
      c = must(buyRestSlot(c));
      c = must(buyRestSlot(c));
      checkEq(c.owned.rest, 4, 'máximo 4');
      const max = buyRestSlot(c);
      check(!max.ok && max.motivo === 'limite', 'limite de vagas');
      checkEq(c.cash, 5000 - 120 - 120 - 80 - 80, 'preços');
      const sem = buyRestSlot({ ...c, owned: { ...c.owned, rest: 0 } });
      check(!sem.ok && sem.motivo === 'requer', 'vaga sem área');
    },
  },
];
