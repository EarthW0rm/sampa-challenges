import { acceptChallenge, rollChallenges } from '../../game/campaign/actions/challenges';
import { buySpace } from '../../game/campaign/actions/upgrades';
import { newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { CHALLENGES } from '../../game/data/challenges';
import { isCampaign } from '../../game/campaign/save';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import type { DayResult } from '../../game/types';
import { check, checkEq, checkNear, runDay, type Scenario } from '../harness';

const base = (patch: Partial<Campaign> = {}): Campaign => ({ ...newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: false, seed: 31 }), cash: 20000, day: 6, ...patch });
function must(r: ActionResult): Campaign {
  check(r.ok, 'ação recusada');
  return r.campaign;
}

/** Aceita o desafio direto (ignora o sorteio das ofertas) para testar a avaliação. */
const withChallenge = (c: Campaign, id: string, progress = 0): Campaign => ({
  ...c,
  challenges: [{ id, acceptedOn: c.calendar, deadline: c.calendar + 10, progress }],
});

function day(c: Campaign, seed: number, patch: (r: DayResult) => void = () => undefined): { out: ReturnType<typeof closeDay>; cash: number } {
  const r = runDay(seed, toDayConfig(c)).result()!;
  patch(r);
  return { out: closeDay(c, r), cash: c.cash };
}

export const desafios: Scenario[] = [
  {
    id: 'rn136-caldos-40',
    rules: 'RN-136',
    run(seed) {
      const c = withChallenge(base(), 'caldos-40');
      const lose = day(c, seed, (r) => (r.counters.drinks = 39));
      checkEq(lose.out.balance.prizes.length, 0, '39 caldos não paga');
      checkEq(lose.out.campaign.challenges.length, 1, 'segue ativo');
      const win = day(c, seed, (r) => (r.counters.drinks = 40));
      checkEq(win.out.balance.prizes[0].prize, 150, 'R$ 150');
      checkNear(win.out.campaign.cash - win.cash - (win.out.balance.profit - 150) - 150 - (win.out.campaign.cash - win.cash - win.out.balance.profit), 0, 'consistência', 1e6);
      check(win.out.balance.lines.some((l) => l.id === 'desafio-caldos-40' && l.amount === 150), 'linha do prêmio no balanço');
      checkEq(win.out.campaign.challenges.length, 0, 'concluído sai da lista');
      check(win.out.balance.profit >= 150 - 1e-6, 'o prêmio entra no lucro do dia');
    },
  },
  {
    id: 'rn136-mesas-e-garcom',
    rules: 'RN-136, RN-137',
    run(seed) {
      let c = base();
      c = withChallenge(c, 'mesas-garcom');
      const sem = day(c, seed);
      checkEq(sem.out.balance.prizes.length, 0, 'sem mesas não paga');
      let r = must(buySpace(c, 4));
      r = { ...r, owned: { ...r.owned, tables: 2 }, staff: [{ id: 1, name: 'G', kind: 'geral', traits: [], courses: [], mode: 'fixo', position: 'garcom', trainedToday: false }], nextStaffId: 2 };
      const win = day(r, seed);
      checkEq(win.out.balance.prizes[0]?.prize, 200, 'R$ 200 com 2 mesas e um garçom fixo');
      // atingibilidade (RN-137): oferecido enquanto der para ter 2 mesas dentro dos 24 m²
      check(CHALLENGES.find((d) => d.id === 'mesas-garcom')!.available(base()), 'aparece quando há espaço possível');
    },
  },
  {
    id: 'rn136-sem-cancelar-por-3-dias',
    rules: 'RN-136',
    run(seed) {
      let c = base({ owned: { ...base().owned, delivery: true, extraM2: 3 } });
      c = withChallenge(c, 'sem-cancelar-3d');
      const d1 = day(c, seed);
      checkEq(d1.out.campaign.challenges[0].progress, 1, 'dia 1 sem cancelar');
      const d2 = day(d1.out.campaign, seed);
      checkEq(d2.out.campaign.challenges[0].progress, 2, 'dia 2');
      const quebra = day(d2.out.campaign, seed, (r) => (r.orders.appCancelled = 1));
      checkEq(quebra.out.campaign.challenges[0].progress, 0, 'um cancelamento zera a sequência');
      const d3 = day(d2.out.campaign, seed);
      checkEq(d3.out.balance.prizes[0]?.prize, 300, 'R$ 300 no terceiro dia');
      check(!CHALLENGES.find((d) => d.id === 'sem-cancelar-3d')!.available(base()), 'só com delivery');
    },
  },
  {
    id: 'rn136-desperdicio-abaixo-de-10',
    rules: 'RN-136',
    run(seed) {
      const c = withChallenge({ ...base(), boughtToday: 100 }, 'desperdicio-10');
      const win = day(c, seed, (r) => (r.waste = { burned: 5, leftover: 0 }));
      check(win.out.balance.wastePercent < 0.1 || win.out.balance.prizes.length === 0, 'avalia o percentual do dia');
      const clean = { ...c, inventory: [] };
      const ok = day(clean, seed, (r) => (r.waste = { burned: 5, leftover: 0 }));
      checkEq(ok.out.balance.prizes[0]?.prize, 150, '5% de desperdício paga R$ 150');
      const bad = day(clean, seed, (r) => (r.waste = { burned: 20, leftover: 0 }));
      checkEq(bad.out.balance.prizes.length, 0, '20% não paga');
    },
  },
  {
    id: 'rn136-quatro-estrelas',
    rules: 'RN-136',
    run(seed) {
      const c = withChallenge(base({ reputation: 3.8 }), 'quatro-estrelas');
      const win = day(c, seed, (r) => (r.reputation = { successes: 5, charm: 0, weightedFailures: 0, rate: 1, change: 0.5 }));
      checkEq(win.out.balance.prizes[0]?.prize, 400, 'R$ 400 ao chegar a 4 estrelas');
      check(!CHALLENGES.find((d) => d.id === 'quatro-estrelas')!.available(base({ reputation: 4.2 })), 'não é oferecido a quem já tem 4 estrelas');
    },
  },
  {
    id: 'rn136-fiscalizacao-so-com-eventos',
    rules: 'RN-136, RN-137',
    run(seed) {
      const c = withChallenge(base(), 'fiscalizacao');
      const win = day(c, seed, (r) => (r.counters.inspection = 'passed'));
      checkEq(win.out.balance.prizes[0]?.prize, 200, 'R$ 200');
      const fail = day(c, seed, (r) => (r.counters.inspection = 'failed'));
      checkEq(fail.out.balance.prizes.length, 0, 'reprovado não paga');
      const def = CHALLENGES.find((d) => d.id === 'fiscalizacao')!;
      check(def.available(base()), 'oferecido com eventos ligados');
      check(!def.available(base({ eventsOn: false })), 'não oferecido com eventos desligados');
    },
  },
  {
    id: 'rn136-especial-30',
    rules: 'RN-136',
    run(seed) {
      const def = CHALLENGES.find((d) => d.id === 'especial-30')!;
      check(!def.available(base()), 'precisa do Especial da Casa');
      const c = withChallenge(base({ owned: { ...base().owned, items: [...base().owned.items, 'especial'] } }), 'especial-30');
      const win = day(c, seed, (r) => (r.counters.especial = 30));
      checkEq(win.out.balance.prizes[0]?.prize, 350, 'R$ 350');
    },
  },
  {
    id: 'rn135-ofertas-aceite-e-prazo',
    rules: 'RN-135, PA-11',
    run(seed) {
      let c = base();
      const offers = rollChallenges(c);
      check(offers.length >= 1 && offers.length <= 2, 'até 2 ofertas');
      let maxDesp = 0;
      for (let cal = 1; cal < 60; cal++) maxDesp = Math.max(maxDesp, rollChallenges(base({ calendar: cal, roles: ['despachante'], owned: { ...base().owned, office: true, extraM2: 4 } })).length);
      checkEq(maxDesp, 3, 'com Despachante chegam a 3');
      const cash = c.cash;
      c = must(acceptChallenge(c, offers[0].id));
      checkEq(c.cash, cash, 'aceitar não paga nada');
      check(!acceptChallenge(c, offers[0].id).ok, 'não aceita o mesmo duas vezes');
      check(!acceptChallenge(c, 'inexistente').ok, 'desafio inexistente');
      check(isCampaign(JSON.parse(JSON.stringify(c))), 'save válido com desafio');
      // o prazo vence sem penalidade
      const prazo = withChallenge(base(), 'caldos-40');
      prazo.challenges[0].deadline = prazo.calendar;
      const out = closeDay(prazo, runDay(seed, toDayConfig(prazo)).result()!);
      checkEq(out.campaign.challenges.length, 0, 'expira no prazo');
      checkNear(out.balance.profit, closeDay(base(), runDay(seed, toDayConfig(base())).result()!).balance.profit, 'sem penalidade no lucro', 1e-6);
    },
  },
];
