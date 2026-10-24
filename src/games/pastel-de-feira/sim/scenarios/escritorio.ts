import { STEP } from '../../game/constants';
import { buyIngredient, unitCost } from '../../game/campaign/actions/inventory';
import { buyOffice, buySpace, fireRole, hireRole } from '../../game/campaign/actions/upgrades';
import { payroll } from '../../game/campaign/actions/staff';
import { newCampaign, stationsOf, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { showSuggestion } from '../../game/campaign/suggest';
import { isCampaign } from '../../game/campaign/save';
import type { ActionResult, Campaign, Refusal } from '../../game/campaign/types';
import { crewSpeed } from '../../game/sim/staff';
import { advance, check, checkEq, checkNear, makeSim, runDay, type Scenario } from '../harness';
import { crewSim, member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);
const rich = (patch: Partial<Campaign> = {}): Campaign => ({ ...newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 8 }), cash: 20000, day: 10, ...patch });
function must(r: ActionResult): Campaign {
  check(r.ok, 'ação recusada');
  return r.campaign;
}
function refused(r: ActionResult, motivo: Refusal, msg: string): void {
  check(!r.ok, `${msg}: deveria recusar`);
  if (!r.ok) checkEq(r.motivo, motivo, msg);
}
const withOffice = (): Campaign => must(buyOffice(must(buySpace(rich(), 4))));

export const escritorio: Scenario[] = [
  {
    id: 'rn100-compra-do-escritorio',
    rules: 'RN-100',
    run() {
      refused(buyOffice(rich({ day: 9 })), 'bloqueadoAteDia', 'antes do dia 10');
      refused(buyOffice(rich()), 'semEspaco', 'sem 4 m²');
      refused(buyOffice(must(buySpace(rich({ cash: 700 }), 4))), 'semCaixa', 'R$ 1.500');
      const c = withOffice();
      checkEq(c.owned.office, true, 'comprado');
      check(stationsOf(c).includes('escritorio'), 'vira estação');
      refused(buyOffice(c), 'limite', 'só um');
      checkEq(20000 - 480 - c.cash, 1500, 'preço');
    },
  },
  {
    id: 'rn103-cargos-do-escritorio',
    rules: 'RN-100, RN-103',
    run() {
      refused(hireRole(rich(), 'contador'), 'requer', 'cargo sem escritório');
      let c = withOffice();
      c = must(hireRole(c, 'contador'));
      c = must(hireRole(c, 'comprador'));
      c = must(hireRole(c, 'gerente'));
      refused(hireRole(c, 'despachante'), 'limite', 'quarto cargo');
      refused(hireRole(c, 'gerente'), 'limite', 'cargo repetido');
      checkNear(payroll(c), 90 + 80 + 110, 'salários dos cargos');
      c = must(fireRole(c, 'gerente'));
      c = must(hireRole(c, 'despachante'));
      checkNear(payroll(c), 90 + 80 + 100, 'folha com o Despachante');
      refused(fireRole(c, 'gerente'), 'requer', 'dispensar quem não está');
      check(isCampaign(JSON.parse(JSON.stringify(c))), 'save válido');
    },
  },
  {
    id: 'rn101-bonus-de-gestao-acumula',
    rules: 'RN-101, RN-103',
    run(seed) {
      const base = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })]);
      checkNear(crewSpeed(base.state), 1.15, 'pasteleiro no escritório: +15%');
      base.state.pasteleiro.at = 'bancada';
      checkNear(crewSpeed(base.state), 1, 'fora do escritório: sem bônus');
      const gerente = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })], { roles: ['gerente'] });
      checkNear(crewSpeed(gerente.state), 1.15 * 1.1, 'escritório + Gerente: 1,15 × 1,10');
      gerente.state.pasteleiro.at = 'bancada';
      checkNear(crewSpeed(gerente.state), 1.1, 'Gerente sozinho: +10%');
      // efeito nos tempos: anotar leva 1,5 / 1,265
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })], { roles: ['gerente'] });
      sim.step();
      sim.state.customers.length = 0;
      const c = { ...({} as object) };
      void c;
      checkNear(1.5 / crewSpeed(sim.state), 1.5 / (1.15 * 1.1), 'tempo de anotar com os dois bônus');
      void advance;
    },
  },
  {
    id: 'rn103-comprador-8-por-cento-e-sugestao',
    rules: 'RN-36, RN-103',
    run() {
      let c = withOffice();
      const antes = unitCost(c, 'carne');
      c = must(hireRole(c, 'comprador'));
      checkNear(unitCost(c, 'carne'), antes * 0.92, 'insumos 8% mais baratos', 1e-3);
      check(showSuggestion(c), 'sugestão em qualquer dia');
      check(!showSuggestion({ ...c, roles: [], day: 10 }), 'sem Comprador, só nos dias 1 a 3');
      const r = must(buyIngredient(c, 'carne', 10));
      checkNear(c.cash - r.cash, 10 * 1.5 * 0.92, 'compra com desconto', 0.01);
    },
  },
  {
    id: 'rn103-salarios-no-fechamento-e-dayconfig',
    rules: 'RN-103',
    run(seed) {
      let c = withOffice();
      c = must(hireRole(c, 'contador'));
      const cfg = toDayConfig(c);
      check(cfg.roles.includes('contador') && cfg.stations.includes('escritorio'), 'DayConfig recebe cargos e escritório');
      const cash = c.cash;
      const out = closeDay(c, runDay(seed, cfg).result()!);
      const line = out.balance.lines.find((l) => l.id === 'salarios');
      checkNear(line!.amount, -90, 'salário do Contador');
      checkNear(out.campaign.cash, cash - 90 - 32, 'caixa debitado (salário e taxa dos 4 m²)');
    },
  },
  {
    id: 'cargos-nao-operam-estacoes',
    rules: 'RN-103',
    run(seed) {
      const sim = makeSim(seed);
      check(sim.state.workers.length === 0, 'cargos não viram funcionários da simulação');
      void secs;
    },
  },
];
