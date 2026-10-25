/**
 * Combinações das regras novas entre si e com as antigas: paciência a partir do pedido anotado (RN-06),
 * Fritador e Montagem por tacho (RN-40, RN-44), cesto avulso (RN-73), opções da campanha (RN-55a) e save v2.
 */
import { FAIL_WEIGHT, STEP } from '../../game/constants';
import { CAMPAIGN_DAYS, defaultStartCash, minReputation, newCampaign, profitGoal, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { startFromHandover } from '../../game/campaign/actions/handover';
import { rollChallenges } from '../../game/campaign/actions/challenges';
import { buyOffice, buySpace } from '../../game/campaign/actions/upgrades';
import { isCampaign, load, saveCampaign, type StorageLike } from '../../game/campaign/save';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import { ITEMS } from '../../game/data/recipes';
import { spawnCustomer } from '../../game/sim/customers';
import { fryWindow, nextFreeBasket, placeBasket } from '../../game/sim/stations/fryer';
import type { TachoConfig } from '../../game/types';
import { pendingUnlock } from '../../game/unlocks';
import { restock } from '../bots';
import { Player, playDay } from '../player';
import { advance, check, checkEq, makeSim, runDay, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { tableSim } from './mesas';
import { crewSim, member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);
const must = (r: ActionResult): Campaign => {
  if (!r.ok) throw new Error(`ação recusada: ${r.motivo}`);
  return r.campaign;
};
const TACHO: TachoConfig = { baskets: 2, oil: 'comum', thermostat: false, alarm: false, timer: false };

function memory(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

export const combinacoes: Scenario[] = [
  // ---------------------------------------------------------------- paciência a partir do pedido anotado
  {
    id: 'rn06-rn07-fila-sem-anotar-as-14h-vai-embora-sem-falha',
    rules: 'RN-06, RN-07, RN-04',
    run(seed) {
      // ninguém anota o dia inteiro: a fila enche, ninguém desiste, e às 14h todos vão embora sem falha
      const sim = runDay(seed, devConfig());
      const r = sim.result()!;
      const s = sim.state;
      checkEq(s.stats.lostPatience, 0, 'sem pedido anotado, ninguém desiste por paciência');
      check(s.stats.queueFull > 0, 'a fila encheu e quem chegou depois foi embora');
      checkEq(s.customers.length, 0, 'às 14h a fila esvazia (RN-07)');
      checkEq(r.orders.served, 0, 'ninguém atendido');
      // só a fila cheia conta falha (peso 0,5 cada); quem estava na fila às 14h sai sem falha
      check(Math.abs(s.rep.failures - FAIL_WEIGHT.queueFull * s.stats.queueFull) < 1e-6, 'falhas = 0,5 × fila cheia');
    },
  },
  {
    id: 'rn06-ignorar-a-fila-nao-compensa',
    rules: 'RN-06, RN-04, RN-60',
    run(seed) {
      // equilíbrio: um dia sem atender ninguém perde a meta e derruba a reputação, mesmo sem desistências
      const c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed });
      const stocked = restock(c);
      const out = closeDay(stocked, runDay(seed, toDayConfig(stocked)).result()!);
      checkEq(out.balance.profitMet, false, 'sem vendas, a meta do dia não sai');
      check(out.balance.reputationAfter < out.balance.reputationBefore, 'a reputação cai com a fila cheia');
      checkEq(out.balance.met, false, 'o dia se repete');
    },
  },
  {
    id: 'rn06-rn82-grupo-na-mesa-so-perde-paciencia-depois-de-anotado',
    rules: 'RN-06, RN-82',
    run(seed) {
      const sim = tableSim(seed, 4, { staff: [member('geral', { mode: 'fixo', position: 'garcom' })] });
      const s = sim.state;
      sim.step(); // o garçom assume a posição
      // garçom ocupado com outra coisa: o grupo sentado espera
      for (let i = 0; i < 200 && !s.customers.some((c) => c.place === 'mesa'); i++) spawnCustomer(s, 'padrao');
      const g = s.customers.find((c) => c.place === 'mesa');
      check(g, 'um grupo sentou para ser atendido pelo garçom');
      s.workers[0].away = 1e9; // pré-condição: o garçom fora da barraca, ninguém anota
      advance(sim, secs(120));
      check(s.customers.includes(g), 'o grupo não desiste antes de anotado');
      checkEq(g.patience, g.patienceMax, 'paciência intacta na mesa');
      g.state = 'anotado';
      advance(sim, secs(10));
      check(g.patience < g.patienceMax, 'depois de anotado, a paciência do grupo corre');
    },
  },

  // ---------------------------------------------------------------- Fritador, Montagem e cestos
  {
    id: 'rn44-rn46-troca-de-oleo-com-pastel-no-tacho-nao-queima',
    rules: 'RN-44, RN-46',
    run(seed) {
      const sim = crewSim(seed, [member('fritador', { mode: 'fixo', position: 'fritador1' })]);
      const s = sim.state;
      const w = s.workers[0];
      const win = fryWindow(ITEMS.carne, s.tachos[0]);
      // pastel no começo da fritura e óleo sujo: o Fritador troca primeiro (o tacho fica parado)
      s.tachos[0].baskets[0].frying = { id: 77, item: 'carne', ticks: secs(1), burned: false, pontoAlerted: false, burnAlerted: false };
      s.tachos[0].dirt = 0.75;
      sim.step();
      checkEq(s.tachos[0].changeBy, w.id, 'o Fritador começou a troca');
      const before = s.tachos[0].baskets[0].frying!.ticks;
      advance(sim, secs(5));
      checkEq(s.tachos[0].baskets[0].frying?.ticks, before, 'durante a troca a fritura não anda');
      advance(sim, secs(win.burnAt + 10));
      checkEq(s.stats.burned, 0, 'o pastel não queimou');
      check(s.ready.some((r) => r.id === 77), 'depois da troca o Fritador tirou o pastel');
      checkEq(s.tachos[0].dirt, 0, 'óleo limpo depois da troca');
    },
  },
  {
    id: 'rn40-rn42-pasteleiro-e-montagem-no-mesmo-tacho',
    rules: 'RN-40, RN-42',
    run(seed) {
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'montagem1' })]);
      const s = sim.state;
      s.assembled.push({ id: 1, item: 'carne' }, { id: 2, item: 'queijo' }, { id: 3, item: 'carne' });
      // o pasteleiro vai ao tacho e coloca enquanto a Montagem também coloca
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(0.5));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      advance(sim, secs(2));
      const frying = s.tachos[0].baskets.map((b) => b.frying?.id).filter((x) => x !== undefined);
      checkEq(frying.length, 2, 'os 2 cestos ocupados, sem pastel em dobro');
      checkEq(new Set(frying).size, 2, 'pastéis diferentes');
      checkEq(s.assembled.length, 1, 'o terceiro espera na bancada (nada se perde)');
    },
  },
  {
    id: 'rn30d-rn73-especial-em-tacho-de-3-cestos',
    rules: 'RN-30d, RN-73',
    run(seed) {
      const sim = makeSim(seed, devConfig({ tachos: [{ ...TACHO, baskets: 3 }] }));
      const s = sim.state;
      const t = s.tachos[0];
      s.assembled.push({ id: 1, item: 'especial' });
      const i = nextFreeBasket(s, t);
      check(i >= 0 && placeBasket(s, t, i), 'o Especial entra (ocupa 2 dos 3 cestos)');
      checkEq(t.baskets.filter((b) => b.frying || b.shadow !== null).length, 2, 'dois cestos ocupados');
      s.assembled.push({ id: 2, item: 'especial' });
      checkEq(nextFreeBasket(s, t), -1, 'o segundo Especial não cabe no cesto que sobrou');
      s.assembled.length = 0;
      s.assembled.push({ id: 3, item: 'carne' });
      const j = nextFreeBasket(s, t);
      check(j >= 0 && placeBasket(s, t, j), 'um pastel comum usa o terceiro cesto');
    },
  },

  // ---------------------------------------------------------------- opções da campanha
  {
    id: 'rn55a-comecar-no-dia-20-entra-no-modo-livre',
    rules: 'RN-55a, RN-53',
    run(seed) {
      const c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed, startDay: CAMPAIGN_DAYS, startCash: 50000 });
      const stocked = restock(c);
      const sim = makeSim(seed, toDayConfig(stocked));
      playDay(sim, new Player());
      const out = closeDay(stocked, sim.result()!);
      if (out.balance.met) {
        checkEq(out.campaign.freeMode, true, 'meta do dia 20 cumprida: modo livre');
        checkEq(out.balance.freeModeStarted, true, 'avisa que a campanha foi zerada');
      } else {
        checkEq(out.campaign.day, CAMPAIGN_DAYS, 'meta perdida: o dia 20 se repete');
      }
      check(isCampaign(out.campaign), 'save válido depois do fechamento');
    },
  },
  {
    id: 'rn55a-comecar-em-dia-alto-com-o-capital-padrao',
    rules: 'RN-55a, RN-50, RN-52',
    run(seed) {
      // dia 15 com R$ 300: meta e reputação mínima do dia 15, estoque comprado com o caixa padrão
      const c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed, startDay: 15 });
      checkEq(c.cash, defaultStartCash('tradicional'), 'capital padrão');
      const stocked = restock(c);
      const cfg = toDayConfig(stocked);
      checkEq(cfg.day, 15, 'dia 15');
      const sim = makeSim(seed, cfg);
      playDay(sim, new Player());
      const out = closeDay(stocked, sim.result()!);
      checkEq(out.balance.goal, profitGoal(15), 'meta do dia 15');
      checkEq(out.balance.minReputation, minReputation(15), 'reputação mínima do dia 15');
      check(out.campaign.cash >= 0, 'não vai à falência no primeiro dia');
    },
  },
  {
    id: 'rn55a-passar-o-ponto-aplica-as-opcoes',
    rules: 'RN-55a, RN-54',
    run(seed) {
      const c = startFromHandover(1000, { profile: 'gestor', eventsOn: false, tutorial: true, seed, startDay: 7, startCash: 2000, staffFatigue: false, unlockAll: true });
      checkEq(c.day, 7, 'dia escolhido');
      check(c.cash > 2000, 'capital escolhido mais a parte do ponto vendido');
      checkEq(c.settings.staffFatigue, false, 'sem cansaço');
      checkEq(c.settings.unlockAll, true, 'melhorias liberadas');
      checkEq(c.tutorial, false, 'sem tutorial fora do dia 1');
    },
  },
  {
    id: 'rn55a-rn171-comecar-no-dia-10-mostra-os-baloes-em-ordem',
    rules: 'RN-55a, RN-171',
    run() {
      const seen: string[] = [];
      for (let u = pendingUnlock(10, seen); u; u = pendingUnlock(10, seen)) seen.push(u.id);
      checkEq(seen.join(','), 'equipe,associacao,delivery,tema,especial,escritorio', 'todos os balões até o dia 10, na ordem dos dias');
    },
  },
  {
    id: 'rn55a-liberado-no-dia-1-escritorio-sim-desafio-de-eventos-nao',
    rules: 'RN-55a, RN-100, RN-135',
    run(seed) {
      let c = newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: false, seed, startCash: 10000, unlockAll: true });
      c = must(buyOffice(must(buySpace(c, 4))));
      checkEq(c.owned.office, true, 'escritório comprado no dia 1');
      for (let k = 0; k < 30; k++) {
        const day = { ...c, calendar: k + 1, seed: seed + k };
        check(!rollChallenges(day).some((d) => d.id === 'fiscalizacao'), 'o desafio de fiscalização (eventos) não aparece antes do dia 4');
      }
    },
  },
  {
    id: 'rn55a-sem-cansaco-ninguem-descansa-o-dia-inteiro',
    rules: 'RN-55a, RN-115, RN-116',
    run(seed) {
      const sim = crewSim(seed, [member('geral'), member('fritador')], { staffFatigue: false, restSlots: 2 });
      sim.state.arrivalLeft = 0;
      advance(sim, secs(230));
      check(sim.state.workers.every((w) => w.energy === 100 && w.resting === null), 'energia 100 e ninguém descansou, mesmo com área de descanso');
    },
  },

  // ---------------------------------------------------------------- save
  {
    id: 'save-v2-tacho-de-3-cestos-e-opcoes',
    rules: 'plan 3.3, RN-73, RN-55a',
    run(seed) {
      const c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed, unlockAll: true, staffFatigue: false });
      c.owned.tachos[0].baskets = 3;
      const st = memory();
      check(saveCampaign(st, c, 'preparo'), 'gravou');
      const back = load(st);
      check(back.save !== null, 'o save com tacho de 3 cestos volta');
      checkEq(back.save!.campaign.owned.tachos[0].baskets, 3, '3 cestos');
      checkEq(JSON.stringify(back.save!.campaign.settings), JSON.stringify({ staffFatigue: false, unlockAll: true }), 'opções preservadas');
      check(!isCampaign({ ...c, owned: { ...c.owned, tachos: [{ ...c.owned.tachos[0], baskets: 5 }] } }), '5 cestos é inválido');
      check(!isCampaign({ ...c, settings: { staffFatigue: 'sim', unlockAll: false } }), 'opção com tipo errado é inválida');
      check(!isCampaign({ ...c, settings: undefined }), 'sem opções é inválido na versão 2');
    },
  },
];

