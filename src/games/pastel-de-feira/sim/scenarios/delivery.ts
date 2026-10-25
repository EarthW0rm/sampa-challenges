import { STEP } from '../../game/constants';
import { acceptOffer, dailyCap, packPastry } from '../../game/sim/delivery';
import { unmetItems } from '../../game/sim/demand';
import type { DaySim } from '../../game/sim/day';
import type { DayConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

export function appConfig(patch: Partial<DayConfig> = {}): DayConfig {
  const base = devConfig();
  return devConfig({
    delivery: { on: true, auto: false, partner: false },
    stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'expedicao', 'escritorio'],
    positions: ['balcao', 'montagem1', 'fritador1', 'trocador', 'moenda', 'expedicao'],
    equipment: { ...base.equipment, warmer: 6 },
    consumables: { copo: 40, saquinho: 100, embalagem: 20 },
    ...patch,
  });
}

export function appSim(seed: number, patch: Partial<DayConfig> = {}): DaySim {
  const sim = makeSim(seed, appConfig(patch));
  sim.state.arrivalLeft = 1e9;
  sim.state.offerLeft = 1e9;
  sim.state.pasteleiro.at = 'escritorio';
  return sim;
}

/** Coloca uma oferta e a aceita. */
function accept(sim: DaySim, items: string[]): number {
  const s = sim.state;
  const id = 5000 + s.nextId++;
  s.offers.push({ id, items, left: 10 });
  check(acceptOffer(s, id), 'aceitou a oferta');
  return id;
}

const ready = (sim: DaySim, id: number, item = 'carne', quality = 90) => {
  sim.state.ready.push({ id, item, quality, readyAt: sim.state.tick * STEP });
};

export const delivery: Scenario[] = [
  {
    id: 'rn95-teto-por-reputacao',
    rules: 'RN-95',
    run(seed) {
      const cap = (rep: number, partner = false) => dailyCap(appSim(seed, { reputation: rep, delivery: { on: true, auto: false, partner } }).state);
      checkEq(cap(3), 3, 'reputação 3,0: 3');
      checkEq(cap(3.4), 3, 'até 3,5 exclusive');
      checkEq(cap(3.5), 6, 'a partir de 3,5: 6');
      checkEq(cap(4.5), 10, 'a partir de 4,5: 10');
      checkEq(cap(3, true), 7, 'Conta Parceira: +4');
      const sim = appSim(seed);
      for (let i = 0; i < 3; i++) accept(sim, ['carne', 'queijo']);
      const extra = { id: 9999, items: ['carne', 'carne'], left: 10 };
      sim.state.offers.push(extra);
      check(!acceptOffer(sim.state, 9999), 'a 4ª aceita é recusada com reputação 3,0');
    },
  },
  {
    id: 'rn91-oferta-dura-10s-e-expira',
    rules: 'RN-91',
    run(seed) {
      const sim = appSim(seed);
      sim.state.offerLeft = 0.01;
      advance(sim, 3);
      checkEq(sim.state.offers.length, 1, 'oferta gerada');
      const o = sim.state.offers[0];
      check(o.items.length >= 2 && o.items.length <= 4, 'de 2 a 4 pastéis');
      check(o.items.every((i) => ['carne', 'queijo'].includes(i)), 'do cardápio');
      advance(sim, secs(9));
      checkEq(sim.state.offers.length, 1, 'ainda visível aos 9 s');
      advance(sim, secs(2));
      checkEq(sim.state.offers.length, 0, 'some em 10 s');
      checkNear(sim.state.rep.failures, 0, 'sem penalidade');
      checkEq(sim.state.acceptedToday, 0, 'nada aceito');
    },
  },
  {
    id: 'pa14-aceite-de-qualquer-posicao-e-embalagem',
    rules: 'PA-14, RN-39a',
    run(seed) {
      const sim = appSim(seed);
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, secs(1));
      sim.state.offers.push({ id: 77, items: ['carne', 'queijo'], left: 10 });
      sim.dispatch({ type: 'acceptOffer', offerId: 77 });
      sim.step();
      checkEq(sim.state.comandas.length, 1, 'aceitou estando na bancada');
      checkEq(sim.state.consumables.embalagem, 19, 'consumiu 1 embalagem do app');
      checkNear(sim.state.comandas[0].pickupAt - sim.state.tick * STEP, 35, 'retirada 35 s depois do aceite', 0.1);
      const sem = appSim(seed, { consumables: { copo: 1, saquinho: 1, embalagem: 0 } });
      sem.state.offers.push({ id: 78, items: ['carne', 'carne'], left: 10 });
      check(!acceptOffer(sem.state, 78), 'sem embalagem do app nenhuma comanda nova é aceita');
      const velha = appSim(seed);
      check(!acceptOffer(velha.state, 12345), 'oferta inexistente');
    },
  },
  {
    id: 'rn90-desligado-nao-oferece',
    rules: 'RN-90',
    run(seed) {
      const sim = appSim(seed, { delivery: { on: false, auto: false, partner: false } });
      sim.state.offerLeft = 0.01;
      advance(sim, secs(60));
      checkEq(sim.state.offers.length, 0, 'sem ofertas com o delivery desligado');
      sim.state.offers.push({ id: 5, items: ['carne', 'carne'], left: 10 });
      check(!acceptOffer(sim.state, 5), 'nem aceite');
    },
  },
  {
    id: 'rn95-aceite-automatico-com-expedicao',
    rules: 'RN-95',
    run(seed) {
      const sim = appSim(seed, {
        delivery: { on: true, auto: true, partner: false },
        staff: [member('geral', { mode: 'fixo', position: 'expedicao' })],
      });
      sim.step();
      for (let i = 0; i < 5; i++) sim.state.offers.push({ id: 100 + i, items: ['carne', 'queijo'], left: 10 });
      advance(sim, 3);
      checkEq(sim.state.comandas.length, 3, 'aceita toda oferta até o teto (3)');
      checkEq(sim.state.acceptedToday, 3, 'contagem do dia');
      const sem = appSim(seed, { delivery: { on: true, auto: true, partner: false } });
      sem.state.offers.push({ id: 1, items: ['carne', 'queijo'], left: 10 });
      advance(sem, 3);
      checkEq(sem.state.comandas.length, 0, 'sem Expedição o aceite é manual');
    },
  },
  {
    id: 'rn92-93-retirada-e-pagamento',
    rules: 'RN-92, RN-93, RN-25',
    run(seed) {
      const sim = appSim(seed);
      accept(sim, ['carne', 'queijo']);
      ready(sim, 1, 'carne', 90);
      ready(sim, 2, 'queijo', 90);
      check(packPastry(sim.state, 1) && packPastry(sim.state, 2), 'embalou os dois');
      advance(sim, secs(36));
      checkEq(sim.state.stats.appPicked, 1, 'retirada no horário');
      // 7 × 0,8 × (0,8 + 0,4 × 0,70) × 1 por pastel; nota 90 − 20 de transporte = 70
      const esperado = Math.round(2 * 7 * 0.8 * (0.8 + 0.4 * 0.7) * 100) / 100;
      checkNear(sim.state.stats.appRevenue, esperado, 'preço −20% × qualidade, sem teto de perfil');
      checkEq(sim.state.rep.successes, 1, 'sucesso');
      const termica = appSim(seed, { equipment: { ...appConfig().equipment, thermalBag: true } });
      accept(termica, ['carne']);
      ready(termica, 1, 'carne', 90);
      packPastry(termica.state, 1);
      advance(termica, secs(36));
      checkNear(termica.state.stats.appRevenue, Math.round(7 * 0.8 * (0.8 + 0.4 * 0.9) * 100) / 100, 'Embalagem Térmica: sem perda no transporte');
    },
  },
  {
    id: 'rn94-comanda-incompleta-cancela',
    rules: 'RN-94, RN-61',
    run(seed) {
      const sim = appSim(seed);
      accept(sim, ['carne', 'queijo']);
      ready(sim, 1, 'carne');
      packPastry(sim.state, 1); // só metade
      advance(sim, secs(35.5));
      checkEq(sim.state.motoboys.length, 1, 'o motoboy chegou');
      advance(sim, secs(24));
      checkEq(sim.state.stats.appCancelled, 0, 'espera até 25 s');
      advance(sim, secs(2));
      checkEq(sim.state.stats.appCancelled, 1, 'cancelada ao sair');
      checkNear(sim.state.rep.failures, 3, 'falha de peso 3,0');
      checkNear(sim.state.stats.appRevenue, 0, 'não paga');
      checkEq(sim.state.ready.length, 0, 'os pastéis já feitos se perdem');
      checkEq(sim.state.comandas.length, 0, 'comanda encerrada');
    },
  },
  {
    id: 'rn92-reputacao-baixa-motoboy-espera-menos',
    rules: 'RN-92',
    run(seed) {
      const sim = appSim(seed, { reputation: 1.5 });
      accept(sim, ['carne']);
      advance(sim, secs(35.5));
      advance(sim, secs(14));
      checkEq(sim.state.stats.appCancelled, 0, 'aos 14 s ainda espera');
      advance(sim, secs(2));
      checkEq(sim.state.stats.appCancelled, 1, 'espera só 15 s (60% de 25)');
    },
  },
  {
    id: 'rn92-motoboy-leva-ate-2-comandas',
    rules: 'RN-92',
    run(seed) {
      const sim = appSim(seed, { reputation: 4.6 });
      accept(sim, ['carne']);
      accept(sim, ['queijo']);
      accept(sim, ['carne']);
      advance(sim, secs(36));
      checkEq(sim.state.motoboys.length, 2, 'três comandas no mesmo horário: 2 motoboys');
      checkEq(sim.state.motoboys.map((m) => m.comandas.length).sort().join(','), '1,2', 'até 2 por motoboy');
    },
  },
  {
    id: 'rn94-nota-baixa-vira-falha-1',
    rules: 'RN-61',
    run(seed) {
      const sim = appSim(seed);
      accept(sim, ['carne']);
      ready(sim, 1, 'carne', 50); // 50 − 20 = 30 < 40
      packPastry(sim.state, 1);
      advance(sim, secs(36));
      checkEq(sim.state.stats.appPicked, 1, 'entregue');
      checkEq(sim.state.rep.successes, 0, 'não é sucesso');
      checkNear(sim.state.rep.failures, 1, 'falha de peso 1,0');
    },
  },
  {
    id: 'rn96-estufa-compartilhada',
    rules: 'RN-96, RN-27',
    run(seed) {
      const sim = appSim(seed);
      const s = sim.state;
      for (let i = 0; i < 5; i++) {
        ready(sim, 10 + i);
        s.ready[s.ready.length - 1].warmed = true; // balcão ocupa 5 das 6 vagas
      }
      accept(sim, ['carne', 'carne']);
      ready(sim, 1);
      ready(sim, 2);
      packPastry(s, 1);
      packPastry(s, 2);
      const warmed = s.ready.filter((r) => r.warmed).length;
      checkEq(warmed, 6, 'só sobrou 1 vaga: um pastel da comanda entra, o outro fica na bancada da Expedição');
      check(s.ready.find((r) => r.id === 1)!.warmed === true, 'o primeiro ocupa a vaga');
      check(!s.ready.find((r) => r.id === 2)!.warmed, 'o segundo decai normalmente');
    },
  },
  {
    id: 'comanda-entra-na-demanda-de-producao',
    rules: 'RN-96',
    run(seed) {
      const sim = appSim(seed);
      accept(sim, ['carne', 'queijo']);
      checkEq(unmetItems(sim.state, false).join(','), 'carne,queijo', 'itens da comanda precisam ser produzidos');
      ready(sim, 1, 'carne');
      packPastry(sim.state, 1);
      checkEq(unmetItems(sim.state, false).join(','), 'queijo', 'o reservado já cobre o seu item');
    },
  },
  {
    id: 'rn07-comanda-pendente-as-14h',
    rules: 'RN-07',
    run(seed) {
      const sim = appSim(seed);
      advance(sim, 14400 - secs(20));
      accept(sim, ['carne', 'queijo']);
      const f0 = sim.state.rep.failures;
      advance(sim, secs(30));
      check(sim.isOver(), 'dia terminou');
      checkNear(sim.state.rep.failures, f0, 'perdida sem falha');
      checkEq(sim.state.stats.appCancelled, 0, 'sem cancelamento');
      checkEq(sim.state.comandas.length, 0, 'limpo');
    },
  },
  {
    id: 'expedicao-embala-sozinha',
    rules: 'RN-40',
    run(seed) {
      const sim = appSim(seed, { staff: [member('geral', { mode: 'fixo', position: 'expedicao' })] });
      sim.step();
      accept(sim, ['carne']);
      ready(sim, 1, 'carne', 90);
      advance(sim, secs(3));
      check(sim.state.comandas[0].packed[0] === 1, 'a Expedição embalou o pastel pronto');
      advance(sim, secs(34));
      checkEq(sim.state.stats.appPicked, 1, 'e o motoboy levou');
    },
  },
];
