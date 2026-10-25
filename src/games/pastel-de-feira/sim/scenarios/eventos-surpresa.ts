import { STEP } from '../../game/constants';
import { newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import type { Campaign } from '../../game/campaign/types';
import type { DaySim } from '../../game/sim/day';
import { fryerTachos } from '../../game/sim/staff';
import { hasPower } from '../../game/sim/world';
import type { DayConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, runDay, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { tableConfig } from './mesas';
import { crewSim, member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

const evSim = (seed: number, forceEvent: string, patch: Partial<DayConfig> = {}): DaySim => {
  const sim = makeSim(seed, tableConfig(0, { eventsOn: true, forceEvent, ...patch }));
  sim.state.arrivalLeft = 1e9;
  sim.state.pasteleiro.at = 'escritorio';
  return sim;
};

export const eventosSurpresa: Scenario[] = [
  {
    id: 'rn150-no-maximo-1-surpresa-e-so-com-eventos',
    rules: 'RN-150',
    run() {
      let fiscal = 0;
      let energia = 0;
      let excursao = 0;
      let nenhum = 0;
      const N = 4000;
      for (let seed = 1; seed <= N; seed++) {
        const s = makeSim(seed, tableConfig(0, { eventsOn: true })).state;
        const k = s.world.kind;
        if (k === 'fiscal') fiscal++;
        else if (k === 'energia') energia++;
        else if (k === 'excursao') excursao++;
        else nenhum++;
        const off = makeSim(seed, tableConfig(0, { eventsOn: false })).state;
        if (off.world.kind !== null) throw new Error('evento agendado com eventos desligados');
      }
      check(Math.abs(fiscal / N - 0.12) < 0.03, `fiscal ~12% (${fiscal / 40}%)`);
      check(Math.abs(energia / N - 0.08) < 0.03, `energia ~8% (${energia / 40}%)`);
      check(Math.abs(excursao / N - 0.08) < 0.03, `excursão ~8% (${excursao / 40}%)`);
      check(nenhum > N * 0.6, 'a maioria dos dias sem surpresa');
    },
  },
  {
    id: 'rn152-fiscal-multa-com-oleo-sujo',
    rules: 'RN-152',
    run(seed) {
      const sim = evSim(seed, 'fiscal');
      sim.state.tachos[0].dirt = 0.75;
      advance(sim, secs(31));
      checkEq(sim.state.stats.inspection, 'failed', 'reprovado com óleo a 75%');
      checkNear(sim.state.stats.fines, 150, 'multa de R$ 150');
      check(sim.drainEvents().some((e) => e.type === 'evento_inicio'), 'evento_inicio');
      check(sim.state.notices.length > 0, 'aviso na tela');
      const c: Campaign = { ...newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: false, seed: 1 }), day: 6, reputation: 3 };
      const r = runDay(seed, toDayConfig(c)).result()!;
      r.counters.inspection = 'failed';
      r.reputation = { successes: 3, charm: 0, weightedFailures: 1, rate: 0.75, change: 0 };
      const out = closeDay(c, r);
      checkNear(out.campaign.reputation, 2.7, 'perde 0,3 de reputação');
    },
  },
  {
    id: 'rn152-fiscal-sujeira-60-tambem-reprova-e-limpo-aprova',
    rules: 'RN-152, RN-62',
    run(seed) {
      const suja = evSim(seed, 'fiscal');
      suja.state.dirt = 60;
      advance(suja, secs(31));
      checkEq(suja.state.stats.inspection, 'failed', 'sujeira 60 reprova');
      const limpa = evSim(seed, 'fiscal');
      advance(limpa, secs(31));
      checkEq(limpa.state.stats.inspection, 'passed', 'barraca limpa aprova');
      checkNear(limpa.state.rep.charm, 2, 'aprovado: +2,0 de encanto');
      checkNear(limpa.state.stats.fines, 0, 'sem multa');
    },
  },
  {
    id: 'rn103-despachante-anula-1-multa-a-cada-5-dias',
    rules: 'RN-103',
    run(seed) {
      const sim = evSim(seed, 'fiscal', { annulFine: true });
      sim.state.tachos[0].dirt = 0.9;
      advance(sim, secs(31));
      checkEq(sim.state.stats.annulled, true, 'multa anulada');
      checkNear(sim.state.stats.fines, 0, 'sem multa');
      const c: Campaign = { ...newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: false, seed: 1 }), day: 6, calendar: 6, reputation: 3, roles: ['despachante'], owned: { ...newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: false, seed: 1 }).owned, office: true } };
      checkEq(toDayConfig(c).annulFine, true, 'disponível com Despachante');
      const r = runDay(seed, toDayConfig(c)).result()!;
      r.counters.inspection = 'failed';
      r.counters.annulled = true;
      r.reputation = { successes: 3, charm: 0, weightedFailures: 1, rate: 0.75, change: 0 };
      const out = closeDay(c, r);
      checkEq(out.campaign.lastAnnul, 6, 'registra o dia da anulação');
      checkNear(out.campaign.reputation, 3, 'sem perda de reputação quando anulada');
      checkEq(toDayConfig({ ...out.campaign, calendar: 10 }).annulFine, false, 'dentro de 5 dias não anula de novo');
      checkEq(toDayConfig({ ...out.campaign, calendar: 11 }).annulFine, true, 'passados 5 dias, anula de novo');
    },
  },
  {
    id: 'rn152-queda-de-energia',
    rules: 'RN-152',
    run(seed) {
      const base = devConfig();
      const sim = evSim(seed, 'energia', { equipment: { ...base.equipment, warmer: 6, mill: 'motorizada' }, stations: ['balcao', 'bancada', 'tacho1', 'estufa', 'moenda', 'escritorio'] });
      const s = sim.state;
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: 0, warmed: true });
      advance(sim, secs(29));
      check(hasPower(s), 'energia ainda no ar');
      advance(sim, secs(2));
      check(!hasPower(s), 'caiu aos 30 s');
      check(s.world.powerLeft >= 20 && s.world.powerLeft <= 40, `de 20 a 40 s (${s.world.powerLeft.toFixed(1)})`);
      check(s.ready[0].warmed === false, 'a estufa para de congelar');
      sim.dispatch({ type: 'tapStation', station: 'moenda' });
      advance(sim, secs(1.5));
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda' });
      advance(sim, secs(3));
      checkEq(s.cups.length, 0, 'moenda motorizada vira manual: 3 s não bastam');
      advance(sim, secs(41));
      check(hasPower(s), 'a energia volta');
      check(Boolean(s.ready[0].warmed), 'a estufa volta a congelar');
    },
  },
  {
    id: 'rn152-excursao-15-clientes-em-20s',
    rules: 'RN-152',
    run(seed) {
      const sim = evSim(seed, 'excursao', { day: 20 });
      const s = sim.state;
      advance(sim, secs(29));
      const antes = s.stats.arrived;
      advance(sim, secs(25));
      checkEq(s.stats.arrived - antes, 15, '15 clientes chegam em 20 s');
      check(s.stats.queueFull > 0 || s.customers.length <= 6, 'a fila pode estourar');
      check(s.customers.length <= 6, 'fila nunca passa de 6');
    },
  },
  {
    id: 'rn152-fogo-no-tacho',
    rules: 'RN-152, spec 4',
    run(seed) {
      const sim = evSim(seed, 'fogo');
      const s = sim.state;
      s.tachos[0].dirt = 0.92;
      for (let i = 0; i < 2; i++) s.assembled.push({ id: 100 + i, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.step();
      check(s.tachos[0].fireLeft > 19, 'fogo por 20 s');
      checkEq(s.tachos[0].baskets[0].frying, null, 'os pastéis dentro se perdem');
      checkNear(s.stats.repairs, 80, 'reparo de R$ 80');
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 1 } });
      sim.step();
      checkEq(s.tachos[0].baskets[1].frying, null, 'tacho parado: nada entra');
      advance(sim, secs(20.5));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 1 } });
      sim.step();
      check(s.tachos[0].baskets[1].frying !== null, 'depois de 20 s volta a funcionar');
      check(s.world.used, 'só uma surpresa por dia');
      // com óleo abaixo de 90% o fogo por pastel não acontece
      const calmo = evSim(seed + 1, 'fogo');
      calmo.state.assembled.push({ id: 1, item: 'carne' });
      calmo.state.tachos[0].dirt = 0.5;
      calmo.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(calmo, secs(1));
      calmo.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      calmo.step();
      checkEq(calmo.state.tachos[0].fireLeft, 0, 'sem fogo com o óleo abaixo de 90%');
    },
  },
  {
    id: 'rn152-fogo-tira-o-funcionario-da-posicao',
    rules: 'RN-152, spec 4',
    run(seed) {
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' })], { eventsOn: true, forceEvent: 'fogo' });
      const s = sim.state;
      sim.step();
      checkEq(s.workers[0].position, 'fritador1', 'Fritador na posição');
      s.tachos[0].fireLeft = 20;
      advance(sim, 2);
      checkEq(fryerTachos(s).get(s.workers[0].id), undefined, 'sem tacho durante o fogo (assume só tacho livre)');
      advance(sim, secs(21));
      checkEq(fryerTachos(s).get(s.workers[0].id), 0, 'volta ao tacho quando o bloqueio acaba');
    },
  },
  {
    id: 'rn152-funcionario-queimado-sai-30s-sem-curso',
    rules: 'RN-152',
    run(seed) {
      const run = (courses: ('fritura')[]) => {
        const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' }, [], courses)], { eventsOn: true, forceEvent: 'queimado' });
        sim.state.assembled.push({ id: 1, item: 'carne' });
        sim.step();
        sim.state.tachos[0].baskets[0].frying = { id: 9, item: 'carne', ticks: secs(7), burned: false, pontoAlerted: false, burnAlerted: false };
        advance(sim, secs(3));
        return sim;
      };
      const sem = run([]);
      check(sem.state.workers[0].away > 25, 'sai por 30 s');
      checkEq(sem.state.workers[0].position, null, 'posição vaga');
      advance(sem, secs(31));
      checkEq(sem.state.workers[0].position, 'fritador1', 'volta depois');
      const com = run(['fritura']);
      checkEq(com.state.workers[0].away, 0, 'com o curso de Fritura nunca se queima');
    },
  },
];
