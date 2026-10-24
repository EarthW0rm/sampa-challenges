import { buyIngredient } from '../../game/campaign/actions/inventory';
import { cloneCampaign, minReputation, newCampaign, profitGoal, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import type { DayResult } from '../../game/types';
import { check, checkEq, checkNear, runDay, type Scenario } from '../harness';

const fresh = (): Campaign => newCampaign({ profile: 'gestor', eventsOn: false, tutorial: false, seed: 11 });

function must(r: ActionResult): Campaign {
  check(r.ok, 'ação recusada');
  return r.campaign;
}

/** Dia sem vendas rodado na simulação real; os testes sobrescrevem os campos que querem. */
function baseResult(c: Campaign, patch: Partial<DayResult> = {}): DayResult {
  const sim = runDay(1, toDayConfig(c));
  return { ...sim.result()!, ...patch };
}

const stocked = (): Campaign => {
  let c = fresh();
  c = must(buyIngredient(c, 'massa', 30));
  c = must(buyIngredient(c, 'carne', 10));
  c = must(buyIngredient(c, 'mucarela', 10));
  c.boughtToday = 50;
  return c;
};

export const fechamento: Scenario[] = [
  {
    id: 'rn50-meta-do-dia',
    rules: 'RN-50',
    run() {
      checkNear(profitGoal(1), 80, 'dia 1', 0.01);
      checkNear(profitGoal(10), 354.84, 'dia 10', 0.01);
      checkNear(profitGoal(20), 1857.15, 'dia 20', 0.05);
      checkEq(minReputation(1), 2, 'dias 1–5');
      checkEq(minReputation(6), 3, 'dias 6–12');
      checkEq(minReputation(13), 3.5, 'dias 13–20');
    },
  },
  {
    id: 'rn37-bonus-de-aproveitamento',
    rules: 'RN-37, PA-04, PA-05',
    run() {
      const c = stocked();
      // 5 unidades descartadas de 50 compradas = 10%: bônus de 5% da receita
      const r = baseResult(c, { revenue: { counter: 200, table: 0, app: 0, order: 0, total: 200 }, waste: { burned: 5, leftover: 0 } });
      let out = closeDay(c, r);
      // sobras de recheio estragam no fechamento: 10 carne + 10 muçarela
      check(out.balance.spoiledUnits >= 20, 'recheio que sobra estraga');
      const total = out.balance.burnedUnits + out.balance.leftoverUnits + out.balance.spoiledUnits;
      checkNear(out.balance.wastePercent, total / 50, 'percentual de desperdício');
      checkEq(out.balance.bonus, 0, 'desperdício acima de 15% não dá bônus');
      // dia sem sobra de recheio e só 2 queimados de 50 comprados (4%): bônus de 11%
      const tight = cloneCampaign(c);
      tight.inventory = tight.inventory.filter((l) => l.ingredient === 'massa');
      tight.boughtToday = 50;
      const quiet = { served: 10, lostPatience: 0, wrong: 0, queueFull: 0, lostPrice: 0, noStock: 0, lostDirt: 0, payFail: 0, appPicked: 0, appCancelled: 0, encDone: 0, encFailed: 0 };
      const r2 = baseResult(tight, { revenue: { counter: 200, table: 0, app: 0, order: 0, total: 200 }, orders: quiet, waste: { burned: 2, leftover: 0 } });
      out = closeDay(tight, r2);
      checkNear(out.balance.bonus, 200 * (0.15 - 0.04), 'bônus = receita × (15% − desperdício)');
      // cliente perdido por falta de insumo: sem bônus
      const falta = baseResult(tight, { revenue: { counter: 200, table: 0, app: 0, order: 0, total: 200 }, orders: { ...r2.orders, noStock: 1 }, waste: { burned: 0, leftover: 0 } });
      checkEq(closeDay(tight, falta).balance.bonus, 0, 'falta de insumo anula o bônus');
      check(closeDay(tight, r2).balance.bonus >= 0, 'bônus nunca negativo');
    },
  },
  {
    id: 'rn50-meta-nao-cumprida-repete-o-dia',
    rules: 'RN-50',
    run() {
      const c = stocked();
      const r = baseResult(c, { revenue: { counter: 20, table: 0, app: 0, order: 0, total: 20 }, reputation: { successes: 1, charm: 0, weightedFailures: 0, rate: 1, change: 0.5 } });
      const { campaign, balance } = closeDay(c, r);
      checkEq(balance.met, false, 'lucro abaixo da meta');
      checkEq(campaign.day, 1, 'o dia não avança');
      checkEq(campaign.calendar, 2, 'o calendário avança');
      checkNear(campaign.reputation, 3.5, 'reputação persiste');
      checkNear(campaign.cash, c.cash + 20, 'caixa atualizado');
      check(campaign.inventory.every((l) => l.ingredient === 'massa'), 'só a massa sobrou');
      checkEq(campaign.history.length, 1, 'histórico');
    },
  },
  {
    id: 'rn50-meta-cumprida-avanca',
    rules: 'RN-50',
    run() {
      const c = stocked();
      const r = baseResult(c, { revenue: { counter: 400, table: 0, app: 0, order: 0, total: 400 }, reputation: { successes: 5, charm: 0, weightedFailures: 0, rate: 1, change: 0.5 } });
      const { campaign, balance } = closeDay(c, r);
      checkEq(balance.met, true, 'meta cumprida');
      checkEq(campaign.day, 2, 'avança');
      check(balance.profit >= 80, `lucro ${balance.profit}`);
      // reputação mínima também conta
      const baixa = { ...c, reputation: 1.2 };
      const r2 = baseResult(baixa, { revenue: { counter: 400, table: 0, app: 0, order: 0, total: 400 }, reputation: { successes: 0, charm: 0, weightedFailures: 5, rate: 0, change: -1 } });
      const out = closeDay(baixa, r2);
      checkEq(out.balance.reputationMet, false, 'reputação abaixo do mínimo');
      checkEq(out.campaign.reputation, 1, 'reputação nunca abaixo de 1');
      checkEq(out.campaign.day, 1, 'não avança sem reputação mínima');
    },
  },
  {
    id: 'rn52-falencia',
    rules: 'RN-52',
    run() {
      const c = stocked();
      c.cash = 0.5;
      const r = baseResult(c, { costs: { oil: 1.5, fines: 0, repairs: 0 } });
      const { campaign, balance } = closeDay(c, r);
      checkEq(balance.bankrupt, true, 'caixa negativo = falência');
      check(campaign.cash < 0, 'caixa −R$ 1');
      const ok = closeDay({ ...c, cash: 5 }, baseResult(c, { costs: { oil: 1.5, fines: 0, repairs: 0 } }));
      checkEq(ok.balance.bankrupt, false, 'caixa positivo segue');
    },
  },
  {
    id: 'rn54-modo-livre',
    rules: 'RN-54, JA-07',
    run() {
      const c = stocked();
      c.day = 20;
      const win = baseResult(c, { revenue: { counter: 5000, table: 0, app: 0, order: 0, total: 5000 }, reputation: { successes: 9, charm: 0, weightedFailures: 0, rate: 1, change: 0.5 } });
      c.reputation = 4;
      const a = closeDay(c, win);
      checkEq(a.balance.met, true, 'meta do dia 20 cumprida');
      checkEq(a.campaign.freeMode, true, 'entra em modo livre');
      checkEq(a.balance.freeModeStarted, true, 'sinalizado');
      checkEq(a.campaign.day, 21, 'dia 21');
      const free = closeDay(a.campaign, baseResult(a.campaign, {}));
      checkEq(free.balance.goal, null, 'modo livre sem meta');
      checkEq(free.campaign.day, 22, 'dias seguem');
    },
  },
  {
    id: 'rn39-caixa-termica-e-validade',
    rules: 'RN-34, RN-39',
    run() {
      let c = fresh();
      c.cash = 5000;
      c.owned.coolers = 1; // 80 unidades
      c = must(buyIngredient(c, 'carne', 60));
      c = must(buyIngredient(c, 'catupiry', 40));
      c = must(buyIngredient(c, 'massa', 10));
      const r = baseResult(c, {});
      const { campaign, balance } = closeDay(c, r);
      const catupiry = campaign.inventory.find((l) => l.ingredient === 'catupiry');
      checkEq(catupiry?.qty, 40, 'o mais caro entra primeiro na caixa');
      checkEq(catupiry?.inCooler, true, 'marcado como guardado');
      const carne = campaign.inventory.find((l) => l.ingredient === 'carne');
      checkEq(carne?.qty, 40, 'o resto da caixa vai para a carne (80 − 40)');
      checkEq(balance.spoiledUnits, 20, '20 unidades de carne estragam');
      checkEq(campaign.inventory.find((l) => l.ingredient === 'massa')?.qty, 10, 'massa segue valendo');
      // no dia seguinte, o que passou a noite na caixa estraga e não renova
      const d2 = closeDay(campaign, baseResult(campaign, {}));
      check(d2.campaign.inventory.every((l) => l.ingredient === 'massa'), 'tudo da caixa estraga no dia seguinte');
      checkEq(d2.balance.spoiledUnits, 80, 'as 80 unidades estragam');
    },
  },
  {
    id: 'massa-vence-no-dia-3',
    rules: 'RN-34',
    run() {
      let c = must(buyIngredient(fresh(), 'massa', 10));
      for (let d = 1; d <= 2; d++) {
        const out = closeDay(c, baseResult(c, {}));
        c = out.campaign;
        checkEq(out.balance.spoiledUnits, 0, `fechamento do dia ${d}: a massa ainda vale`);
      }
      const out = closeDay(c, baseResult(c, {}));
      checkEq(out.balance.spoiledUnits, 10, 'vence no fechamento do dia 3');
    },
  },
  {
    id: 'rn30c-fadiga-conta-dias-no-cardapio',
    rules: 'RN-30c',
    run() {
      let c = fresh();
      for (let d = 0; d < 5; d++) c = closeDay(c, baseResult(c, {})).campaign;
      checkEq(c.fatigue.carne, 5, '5 dias seguidos');
      c.menu.salgados = ['queijo'];
      c = closeDay(c, baseResult(c, {})).campaign;
      checkEq(c.fatigue.carne, undefined, 'um dia fora zera a fadiga');
      checkEq(c.fatigue.queijo, 6, 'a receita que ficou continua contando');
    },
  },
];
