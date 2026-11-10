import { STEP } from '../../game/constants';
import { acceptOffer, dailyCap } from '../../game/sim/delivery';
import { currentQuality } from '../../game/sim/quality';
import { fill, openTickets } from '../../game/sim/tickets';
import type { Ticket } from '../../game/sim/state';
import { unmet } from '../../game/sim/production';
import type { DaySim } from '../../game/sim/day';
import type { DayConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { member } from './posicoes';
import { DEFAULT_STYLE, Player } from '../player';

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

/** Comandas do app abertas, da mais antiga para a mais nova. */
export const appTickets = (sim: DaySim): Ticket[] => openTickets(sim.state, 'expedicao').filter((t) => t.kind === 'app');

/** Põe o pronto na sacola da comanda do app mais antiga (atalho dos cenários, sem passar pela estação). */
function pack(sim: DaySim, id: number): boolean {
  const t = appTickets(sim).find((x) => x.slots.some((l) => l.filled === null));
  return !!t && fill(sim.state, t, { kind: 'pastel', id });
}

/** O pasteleiro fica no balcão da Expedição: há atendente na fila (RN-191). */
const attend = (sim: DaySim) => {
  sim.state.pasteleiro.at = 'expedicao';
};

/** Nota na retirada de um pastel posto na sacola no instante `t0`: a sacola reduz o decaimento (RN-189). */
const bagNote = (q: number, waited: number) => q - Math.max(0, waited - 20) * 0.25;


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
    id: 'rn91-rn180-aceite-cria-comanda-app-de-qualquer-posicao',
    rules: 'RN-91, RN-180, PA-14, RN-39a',
    run(seed) {
      const sim = appSim(seed);
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, secs(1));
      sim.state.offers.push({ id: 77, items: ['carne', 'queijo'], left: 10 });
      sim.dispatch({ type: 'acceptOffer', offerId: 77 });
      sim.step();
      const t = appTickets(sim);
      checkEq(t.length, 1, 'aceitou estando na bancada: comanda APP no trilho da Expedição');
      checkEq(t[0].track, 'expedicao', 'trilho da Expedição');
      checkEq(t[0].slots.map((l) => l.item).join(','), 'carne,queijo', 'um item por pastel da oferta');
      checkEq(sim.state.consumables.embalagem, 19, 'consumiu 1 embalagem do app');
      checkNear(t[0].pickupAt! - sim.state.tick * STEP, 35, 'o motoboy chega 35 s depois do aceite', 0.1);
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
      checkEq(appTickets(sim).length, 3, 'aceita toda oferta até o teto (3)');
      checkEq(sim.state.acceptedToday, 3, 'contagem do dia');
      const sem = appSim(seed, { delivery: { on: true, auto: true, partner: false } });
      sem.state.offers.push({ id: 1, items: ['carne', 'queijo'], left: 10 });
      advance(sem, 3);
      checkEq(appTickets(sem).length, 0, 'sem Expedição o aceite é manual');
    },
  },
  {
    id: 'rn95-aceite-automatico-exige-insumo',
    rules: 'RN-95, DCE-07',
    run(seed) {
      const base = appConfig();
      const stock = base.stock.map((l) => (l.ingredient === 'carne' ? { ...l, qty: 2 } : l));
      const sim = appSim(seed, { delivery: { on: true, auto: true, partner: false }, stock, staff: [member('geral', { mode: 'fixo', position: 'expedicao' })] });
      sim.step();
      sim.state.offers.push({ id: 1, items: ['carne', 'carne', 'carne'], left: 10 });
      advance(sim, 3);
      checkEq(appTickets(sim).length, 0, 'carne para 2, oferta de 3: não aceita');
      sim.state.offers.push({ id: 2, items: ['carne', 'queijo'], left: 10 });
      advance(sim, 3);
      checkEq(appTickets(sim).length, 1, 'oferta coberta pelo estoque: aceita');
      sim.state.offers.push({ id: 3, items: ['carne', 'carne'], left: 10 });
      advance(sim, 3);
      checkEq(appTickets(sim).length, 1, 'a carne restante já está reservada pela lista de produção');
      check(acceptOffer(sim.state, 3), 'o aceite manual continua permitido sem insumo');
    },
  },
  {
    id: 'rn193-rn191-motoboy-chega-e-leva-a-sacola-completa',
    rules: 'RN-193, RN-191, RN-93, RN-25, RN-189',
    run(seed) {
      const sim = appSim(seed);
      attend(sim);
      accept(sim, ['carne', 'queijo']);
      ready(sim, 1, 'carne', 90);
      ready(sim, 2, 'queijo', 90);
      check(pack(sim, 1) && pack(sim, 2), 'pôs os dois na sacola');
      advance(sim, secs(34.9));
      checkEq(sim.state.dispatchQueue.length, 0, 'o motoboy ainda não chegou');
      advance(sim, secs(0.2));
      checkEq(sim.state.dispatchQueue.length, 1, 'o motoboy chega 35 s depois do aceite e entra na fila');
      advance(sim, secs(1.6));
      checkEq(sim.state.stats.appPicked, 1, 'sacola completa e atendente: entrega em 1,5 s');
      checkEq(sim.state.dispatchQueue.length, 0, 'o motoboy saiu');
      checkEq(appTickets(sim).length, 0, 'a comanda saiu do trilho');
      // 7 × 0,8 × qualidade(nota da retirada − 20 de transporte) por pastel
      const nota = bagNote(90, 36.6) - 20;
      checkNear(sim.state.stats.appRevenue, Math.round(2 * 7 * 0.8 * (0.8 + 0.4 * nota / 100) * 100) / 100, 'preço −20% × qualidade, sem teto de perfil', 0.02);
      checkEq(sim.state.rep.successes, 1, 'sucesso');
      const termica = appSim(seed, { equipment: { ...appConfig().equipment, thermalBag: true } });
      attend(termica);
      accept(termica, ['carne']);
      ready(termica, 1, 'carne', 90);
      pack(termica, 1);
      advance(termica, secs(37));
      checkNear(termica.state.stats.appRevenue, Math.round(7 * 0.8 * (0.8 + 0.4 * bagNote(90, 36.6) / 100) * 100) / 100, 'Embalagem Térmica: sem perda no transporte', 0.02);
    },
  },
  {
    id: 'rn191-sem-atendente-a-fila-cresce',
    rules: 'RN-191, RN-193',
    run(seed) {
      const sim = appSim(seed, { reputation: 4.6 });
      accept(sim, ['carne']);
      accept(sim, ['queijo']);
      accept(sim, ['carne']);
      ready(sim, 1, 'carne');
      pack(sim, 1);
      advance(sim, secs(36));
      checkEq(sim.state.dispatchQueue.length, 3, 'uma sacola por motoboy: três na fila');
      checkEq(sim.state.stats.appPicked, 0, 'sem atendente ninguém é atendido, nem com a sacola completa');
      attend(sim);
      advance(sim, secs(2));
      checkEq(sim.state.stats.appPicked, 1, 'com o atendente, o da frente leva a sua sacola');
      checkEq(sim.state.dispatchQueue.length, 2, 'os outros continuam na fila');
    },
  },
  {
    id: 'rn192-rn94-paciencia-esgotada-cancela',
    rules: 'RN-192, RN-94, RN-61',
    run(seed) {
      const sim = appSim(seed);
      attend(sim);
      accept(sim, ['carne', 'queijo']);
      ready(sim, 1, 'carne');
      pack(sim, 1); // só metade
      advance(sim, secs(35.5));
      checkEq(sim.state.dispatchQueue.length, 1, 'o motoboy chegou');
      advance(sim, secs(24));
      checkEq(sim.state.stats.appCancelled, 0, 'espera até 25 s');
      advance(sim, secs(2));
      checkEq(sim.state.stats.appCancelled, 1, 'cancelada ao sair');
      checkNear(sim.state.rep.failures, 3, 'falha de peso 3,0');
      checkNear(sim.state.stats.appRevenue, 0, 'não paga');
      checkEq(sim.state.ready.length, 0, 'o pastel posto na sacola se perde');
      checkEq(appTickets(sim).length, 0, 'comanda encerrada');
      checkEq(sim.state.dispatchQueue.length, 0, 'o motoboy foi embora');
    },
  },
  {
    id: 'rn192-reputacao-baixa-motoboy-espera-menos',
    rules: 'RN-192',
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
    id: 'rn94-nota-baixa-vira-falha-1',
    rules: 'RN-61',
    run(seed) {
      const sim = appSim(seed);
      attend(sim);
      accept(sim, ['carne']);
      ready(sim, 1, 'carne', 50); // 50 − 20 de transporte < 40
      pack(sim, 1);
      advance(sim, secs(37));
      checkEq(sim.state.stats.appPicked, 1, 'entregue');
      checkEq(sim.state.rep.successes, 0, 'não é sucesso');
      checkNear(sim.state.rep.failures, 1, 'falha de peso 1,0');
    },
  },
  {
    id: 'rn189-sacola-reduz-o-decaimento',
    rules: 'RN-189, RN-25',
    run(seed) {
      const sim = appSim(seed);
      accept(sim, ['carne', 'carne']);
      ready(sim, 1, 'carne', 80);
      pack(sim, 1);
      const r = appTickets(sim)[0].slots[0].filled as { quality: number; readyAt: number; bagged?: boolean };
      checkEq(r.bagged, true, 'na sacola');
      checkNear(currentQuality(r as never, r.readyAt + 60), 80 - 40 * 0.25, 'na sacola cai 1/4 do ritmo depois dos 20 s');
      checkNear(currentQuality({ id: 9, item: 'carne', quality: 80, readyAt: r.readyAt }, r.readyAt + 60), 40, 'fora da sacola, o ritmo normal');
    },
  },
  {
    id: 'rn27-pastel-sai-da-estufa-ao-entrar-na-sacola',
    rules: 'RN-27, RN-189',
    run(seed) {
      const sim = appSim(seed);
      const s = sim.state;
      accept(sim, ['carne']);
      ready(sim, 1, 'carne');
      s.ready[0].warmed = true;
      pack(sim, 1);
      checkEq(s.ready.filter((r) => r.warmed).length, 0, 'a vaga da estufa liberou');
      const r = appTickets(sim)[0].slots[0].filled as { warmed?: boolean; bagged?: boolean };
      check(!r.warmed && r.bagged === true, 'na sacola, fora da estufa');
    },
  },
  {
    id: 'rn187-comanda-app-entra-na-lista-de-producao',
    rules: 'RN-187',
    run(seed) {
      const sim = appSim(seed);
      accept(sim, ['carne', 'queijo']);
      checkEq(unmet(sim.state, false).join(','), 'carne,queijo', 'itens da comanda precisam ser produzidos');
      ready(sim, 1, 'carne');
      pack(sim, 1);
      checkEq(unmet(sim.state, false).join(','), 'queijo', 'o item já na sacola sai da lista');
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
      checkEq(appTickets(sim).length, 0, 'limpo');
      checkEq(sim.state.dispatchQueue.length, 0, 'fila vazia');
    },
  },
  {
    id: 'rn183-rn188-expedicao-preenche-e-entrega-sozinha',
    rules: 'RN-183, RN-188, RN-191, RN-40',
    run(seed) {
      const sim = appSim(seed, { staff: [member('geral', { mode: 'fixo', position: 'expedicao' })] });
      sim.step();
      accept(sim, ['carne']);
      ready(sim, 1, 'carne', 90);
      advance(sim, secs(3));
      check(appTickets(sim)[0].slots[0].filled !== null, 'a Expedição pôs o pastel na sacola');
      advance(sim, secs(35));
      checkEq(sim.state.stats.appPicked, 1, 'e entregou ao motoboy');
    },
  },
  {
    id: 'jogador-automatico-atende-a-expedicao',
    rules: 'RN-183, RN-191, RN-187',
    run(seed) {
      const sim = appSim(seed);
      sim.state.pasteleiro.at = 'balcao';
      accept(sim, ['carne', 'queijo']);
      const p = new Player({ ...DEFAULT_STYLE, attendDispatch: true });
      for (let i = 0; i < secs(90) && sim.state.stats.appPicked === 0; i++) {
        p.act(sim);
        sim.step();
      }
      checkEq(sim.state.stats.appPicked, 1, 'produziu, pôs na sacola e entregou ao motoboy');
    },
  },
];
