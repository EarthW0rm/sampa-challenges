import { PATIENCE, STEP } from '../../game/constants';
import { unitCost } from '../../game/campaign/actions/inventory';
import { payroll } from '../../game/campaign/actions/staff';
import { CAMPAIGN_DAYS, MAX_START_CASH, newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { buyRecipe } from '../../game/campaign/actions/upgrades';
import { offers } from '../../game/campaign/shop';
import { crewSim, member } from './posicoes';
import type { Campaign, PastryProfile } from '../../game/campaign/types';
import { addCustomer } from '../../game/sim/customers';
import type { DaySim } from '../../game/sim/day';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import { devConfig } from '../testConfig';

const secs = (n: number): number => Math.round(n / STEP);
const camp = (profile: PastryProfile, patch: Partial<Campaign> = {}): Campaign => ({ ...newCampaign({ profile, eventsOn: false, tutorial: false, seed: 4 }), ...patch });

function fry(profile: PastryProfile, seconds: number): DaySim {
  const sim = makeSim(1, devConfig({ profile }));
  sim.state.arrivalLeft = 1e9;
  sim.state.assembled.push({ id: 1, item: 'carne' });
  sim.dispatch({ type: 'tapStation', station: 'tacho1' });
  advance(sim, secs(1));
  sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
  advance(sim, secs(seconds));
  sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
  sim.step();
  return sim;
}

export const perfis: Scenario[] = [
  {
    id: 'rn110-tradicional-mais-100-no-caixa',
    rules: 'RN-51, RN-110',
    run() {
      checkEq(camp('tradicional').cash, 300, 'Tradicional começa com R$ 300');
      for (const p of ['negociante', 'chapeiro', 'boa-praca', 'gestor'] as const) checkEq(camp(p).cash, 200, `${p}: R$ 200`);
      checkEq(camp('tradicional').reputation, 3, 'reputação inicial 3,0');
    },
  },
  {
    id: 'rn110-negociante-e-comprador-acumulam',
    rules: 'RN-110, RN-103',
    run() {
      const base = unitCost(camp('tradicional'), 'carne');
      checkNear(unitCost(camp('negociante'), 'carne'), base * 0.9, 'insumos −10%', 1e-3);
      checkNear(unitCost(camp('negociante', { roles: ['comprador'] }), 'carne'), base * 0.9 * 0.92, 'Negociante + Comprador: × 0,9 × 0,92', 1e-3);
      checkNear(unitCost(camp('gestor'), 'carne'), base, 'outros perfis sem desconto');
    },
  },
  {
    id: 'rn110-gestor-salarios-menos-10',
    rules: 'RN-110',
    run() {
      const staff = [{ id: 1, name: 'A', kind: 'fritador' as const, traits: [], courses: [], mode: 'auto' as const, position: null, trainedToday: false }];
      checkNear(payroll(camp('tradicional', { staff })), 75, 'base');
      checkNear(payroll(camp('gestor', { staff })), 67.5, 'Gestor: −10%');
    },
  },
  {
    id: 'rn110-chapeiro-janela-mais-1s-so-do-pasteleiro',
    rules: 'RN-110',
    run() {
      // Carne: ponto 5–8 s, queima em 10 s. Aos 8,9 s o pastel está "passado" para um jogador comum.
      checkEq(fry('tradicional', 8.9).state.ready[0].quality, 55, 'sem Chapeiro: passado aos 8,9 s');
      checkEq(fry('chapeiro', 8.9).state.ready[0].quality, 80, 'Chapeiro: ainda no ponto aos 8,9 s');
      checkEq(fry('chapeiro', 9.5).state.ready[0].quality, 55, 'depois de 9 s já passou');
      checkEq(fry('chapeiro', 3).state.ready[0].quality, 40, 'cru continua cru');
      const q = fry('chapeiro', 10.1);
      checkEq(q.state.ready.length, 0, 'a queima não muda');
      // funcionário não ganha o bônus: o Fritador tira no meio da janela de qualquer forma
      check(toDayConfig(camp('chapeiro')).profile === 'chapeiro', 'o perfil vai para o DayConfig');
    },
  },
  {
    id: 'rn110-boa-praca-paciencia-mais-15',
    rules: 'RN-110',
    run() {
      const normal = makeSim(1, devConfig({ profile: 'tradicional' }));
      const boa = makeSim(1, devConfig({ profile: 'boa-praca' }));
      checkNear(addCustomer(normal.state, 'padrao', ['carne']).patience, PATIENCE.padrao, 'base');
      checkNear(addCustomer(boa.state, 'padrao', ['carne']).patience, PATIENCE.padrao * 1.15, 'Boa-praça: +15%');
      checkNear(addCustomer(boa.state, 'exigente', ['carne']).patience, PATIENCE.exigente * 1.15, 'também no Exigente');
    },
  },
  {
    id: 'rn55a-capital-e-dia-inicial',
    rules: 'RN-55a',
    run() {
      const opts = { profile: 'tradicional' as const, eventsOn: false, tutorial: true, seed: 4 };
      checkEq(newCampaign(opts).cash, 300, 'padrão do Tradicional: R$ 300');
      checkEq(newCampaign({ ...opts, startCash: 100 }).cash, 300, 'nunca abaixo do padrão');
      checkEq(newCampaign({ ...opts, startCash: 5000 }).cash, 5000, 'capital escolhido');
      checkEq(newCampaign({ ...opts, startCash: 1e9 }).cash, MAX_START_CASH, 'teto do capital');
      const d8 = newCampaign({ ...opts, startDay: 8 });
      checkEq([d8.day, d8.calendar].join(','), '8,8', 'começa no dia 8');
      checkEq(d8.tutorial, false, 'tutorial só no dia 1');
      checkEq(toDayConfig(d8).day, 8, 'o dia de feira é o 8');
      checkEq(newCampaign({ ...opts, startDay: 99 }).day, CAMPAIGN_DAYS, 'no máximo o último dia da campanha');
      checkEq(newCampaign(opts).settings.staffFatigue && !newCampaign(opts).settings.unlockAll, true, 'padrão: com cansaço e com travas por dia');
    },
  },
  {
    id: 'rn55a-liberar-melhorias',
    rules: 'RN-55a, RN-73',
    run() {
      const base = { profile: 'tradicional' as const, eventsOn: false, tutorial: false, seed: 4, startCash: 5000 };
      const travada = newCampaign(base);
      const r = buyRecipe(travada, 'palmito');
      checkEq(r.ok ? 'ok' : r.motivo, 'bloqueadoAteDia', 'sem a opção: Palmito só a partir do dia 6');
      check(offers(travada).some((o) => o.minDay === 6), 'a loja mostra o dia mínimo');
      const livre = newCampaign({ ...base, unlockAll: true });
      check(buyRecipe(livre, 'palmito').ok, 'com a opção: Palmito no dia 1');
      check(offers(livre).every((o) => o.minDay === undefined), 'nenhuma oferta travada por dia');
    },
  },
  {
    id: 'rn55a-sem-cansaco-da-equipe',
    rules: 'RN-55a, RN-115',
    run(seed) {
      const on = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })]);
      const off = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })], { staffFatigue: false });
      advance(on, secs(60));
      advance(off, secs(60));
      check(on.state.workers[0].energy < 100, 'com cansaço, a energia cai');
      checkEq(off.state.workers[0].energy, 100, 'sem cansaço, a energia fica em 100');
      checkEq(newCampaign({ profile: 'gestor', eventsOn: false, tutorial: false, seed: 1, staffFatigue: false }).settings.staffFatigue, false, 'a opção vai para a campanha');
      checkEq(toDayConfig(newCampaign({ profile: 'gestor', eventsOn: false, tutorial: false, seed: 1, staffFatigue: false })).staffFatigue, false, 'e para o dia');
    },
  },
];
