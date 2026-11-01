import { STEP } from '../../game/constants';
import { acceptOrder, autoAcceptOrders, orderShortfall, rollOrders } from '../../game/campaign/actions/orders';
import { buyIngredient } from '../../game/campaign/actions/inventory';
import { buyDeliveryArea, buyOffice, buySpace, hireRole } from '../../game/campaign/actions/upgrades';
import { cloneCampaign, newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { isCampaign } from '../../game/campaign/save';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import { unmet } from '../../game/sim/production';
import { fill, openTickets } from '../../game/sim/tickets';
import type { Ticket } from '../../game/sim/state';
import { currentQuality } from '../../game/sim/quality';
import { warmedCount } from '../../game/sim/stations/warmer';
import type { OrderConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, runDay, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

const order = (patch: Partial<OrderConfig> = {}): OrderConfig => ({ id: 7, item: 'carne', qty: 20, pickupAt: 60, pay: 208, fine: 104, ...patch });

/** Encomenda exige escritório e área de delivery: a Expedição monta a caixa e atende o cliente (RN-102, RN-104). */
function orderSim(seed: number, o: OrderConfig = order(), staff = devConfig().staff) {
  const sim = makeSim(seed, devConfig({
    orders: [o], staff,
    stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'expedicao', 'escritorio'],
    positions: ['balcao', 'montagem1', 'fritador1', 'trocador', 'moenda', 'expedicao'],
  }));
  sim.state.arrivalLeft = 1e9;
  sim.state.offerLeft = 1e9;
  return sim;
}

/** Comanda E da encomenda. */
const orderTicket = (sim: ReturnType<typeof orderSim>): Ticket | undefined => openTickets(sim.state, 'expedicao').find((t) => t.kind === 'encomenda');

/** Põe `n` pastéis prontos na caixa da encomenda (atalho dos cenários). */
function boxN(sim: ReturnType<typeof orderSim>, n: number, quality = 90) {
  const t = orderTicket(sim)!;
  for (let i = 0; i < n; i++) {
    sim.state.ready.push({ id: 100 + i, item: 'carne', quality, readyAt: sim.state.tick * STEP });
    check(fill(sim.state, t, { kind: 'pastel', id: 100 + i }), `encaixotou ${i + 1}`);
  }
}

const rich = (patch: Partial<Campaign> = {}): Campaign => {
  let c: Campaign = { ...newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 15 }), cash: 20000, day: 10, ...patch };
  const r1 = buySpace(c, 7) as ActionResult;
  if (r1.ok) c = r1.campaign;
  const r2 = buyOffice(c);
  if (r2.ok) c = r2.campaign;
  const r3 = buyDeliveryArea(c); // encomenda exige escritório e área de delivery (RN-102)
  if (r3.ok) c = r3.campaign;
  return c;
};

export const encomendas: Scenario[] = [
  {
    id: 'rn104-rn180-encomenda-vira-comanda-e-as-7h',
    rules: 'RN-104, RN-180, RN-187',
    run(seed) {
      const sim = orderSim(seed, order({ qty: 12 }));
      const t = orderTicket(sim);
      check(t, 'a encomenda aceita é a comanda E no trilho da Expedição');
      checkEq(t.track, 'expedicao', 'trilho da Expedição');
      checkEq(t.enteredAt, 0, 'entra às 07h');
      checkEq(t.slots.length, 12, 'uma unidade por item');
      checkEq(unmet(sim.state, false).length, 12, 'os 12 pastéis entram na lista de produção');
      boxN(sim, 5);
      checkEq(unmet(sim.state, false).length, 7, 'os encaixotados já contam');
    },
  },
  {
    id: 'rn104-encomenda-completa-paga-1-3x',
    rules: 'RN-102, RN-104, RN-191',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'expedicao';
      boxN(sim, 20);
      advance(sim, secs(59));
      checkEq(sim.state.dispatchQueue.length, 0, 'o cliente ainda não chegou');
      advance(sim, secs(3));
      checkEq(sim.state.stats.encDone, 1, 'entregue quando o cliente chega e a Expedição atende');
      checkNear(sim.state.stats.orderRevenue, 20 * 8 * 1.3, '20 pastéis a 1,3 × a referência');
      checkEq(sim.state.rep.successes, 1, 'sucesso');
      checkEq(sim.state.ready.length, 0, 'a caixa saiu com o cliente');
      checkEq(warmedCount(sim.state), 0, 'a encomenda não usa a estufa');
    },
  },
  {
    id: 'rn104-rn192-incompleta-multa-e-falha',
    rules: 'RN-104, RN-192, RN-61',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'expedicao';
      boxN(sim, 19);
      advance(sim, secs(60 + 29));
      checkEq(sim.state.dispatchQueue.length, 1, 'o cliente espera 30 s na fila da Expedição');
      advance(sim, secs(2));
      checkEq(sim.state.dispatchQueue.length, 0, 'foi embora');
      checkNear(sim.state.stats.fines, 104, 'multa de 50% do pagamento');
      checkNear(sim.state.rep.failures, 3, 'falha de peso 3,0');
      checkNear(sim.state.stats.orderRevenue, 0, 'sem pagamento');
      checkEq(sim.state.stats.encFailed, 1, 'contado');
      check(!orderTicket(sim), 'a comanda E saiu do trilho');
    },
  },
  {
    id: 'rn104-completar-durante-a-espera',
    rules: 'RN-104, RN-182',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'expedicao';
      boxN(sim, 19);
      advance(sim, secs(60 + 20));
      sim.state.ready.push({ id: 999, item: 'carne', quality: 90, readyAt: sim.state.tick * STEP });
      sim.dispatch({ type: 'fill', ticketId: orderTicket(sim)!.id, item: { kind: 'pastel', id: 999 } });
      advance(sim, secs(2));
      checkEq(sim.state.stats.encDone, 1, 'completada a tempo');
      checkNear(sim.state.stats.fines, 0, 'sem multa');
    },
  },
  {
    id: 'rn191-sem-atendente-a-encomenda-espera',
    rules: 'RN-191, RN-104',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'escritorio';
      boxN(sim, 20);
      advance(sim, secs(75));
      checkEq(sim.state.stats.encDone, 0, 'ninguém na Expedição');
      sim.dispatch({ type: 'tapStation', station: 'expedicao' });
      advance(sim, secs(4));
      checkEq(sim.state.stats.encDone, 1, 'o pasteleiro chega e entrega dentro dos 30 s');
    },
  },
  {
    id: 'rn183-balcao-nao-atende-a-encomenda-e-a-expedicao-sim',
    rules: 'RN-183, RN-191',
    run(seed) {
      const balcao = orderSim(seed, order(), [member('geral', { mode: 'fixo', position: 'balcao' })]);
      balcao.state.pasteleiro.at = 'escritorio';
      balcao.step();
      boxN(balcao, 20);
      advance(balcao, secs(62));
      checkEq(balcao.state.stats.encDone, 0, 'o Balcão não atende a fila da Expedição');
      const exp = orderSim(seed, order(), [member('geral', { mode: 'fixo', position: 'expedicao' })]);
      exp.state.pasteleiro.at = 'escritorio';
      exp.step();
      boxN(exp, 20);
      advance(exp, secs(62));
      checkEq(exp.state.stats.encDone, 1, 'a Expedição entrega');
    },
  },
  {
    id: 'rn189-caixa-reduz-o-decaimento',
    rules: 'RN-189, RN-104',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'escritorio';
      boxN(sim, 1, 80);
      const r = orderTicket(sim)!.slots[0].filled as { quality: number; readyAt: number; bagged?: boolean };
      checkEq(r.bagged, true, 'na caixa');
      checkEq(currentQuality(r as never, r.readyAt + 20), 80, 'nos primeiros 20 s não cai');
      checkNear(currentQuality(r as never, r.readyAt + 60), 70, 'depois cai 1/4 de ponto por segundo');
    },
  },
  {
    id: 'rn07-encomenda-pendente-as-14h',
    rules: 'RN-07',
    run(seed) {
      const sim = orderSim(seed, order({ pickupAt: 239.5 }));
      sim.state.pasteleiro.at = 'escritorio';
      advance(sim, secs(245));
      check(sim.isOver(), 'dia terminou');
      checkNear(sim.state.rep.failures, 0, 'sem falha no corte seco');
      checkNear(sim.state.stats.fines, 0, 'sem multa');
    },
  },
  {
    id: 'campanha-ofertas-de-encomenda',
    rules: 'RN-102, RN-103, D-04',
    run() {
      check(rollOrders(newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 1 })).length === 0, 'sem escritório não há ofertas');
      let max = 0;
      let maxDesp = 0;
      for (let cal = 1; cal <= 80; cal++) {
        const c = rich({ calendar: cal });
        const offers = rollOrders(c);
        max = Math.max(max, offers.length);
        for (const o of offers) {
          check(o.qty >= 10 && o.qty <= 40, 'quantidade de 10 a 40');
          check(o.hour >= 9 && o.hour <= 13.5, 'retirada entre 09h e 13h30');
          checkNear(o.pay, Math.round(o.qty * 8 * 1.3 * 100) / 100 || o.pay, 'pagamento ≈ 1,3× a referência por unidade', 20);
          checkNear(o.fine, Math.round(o.pay * 0.5 * 100) / 100, 'multa de 50%');
        }
        const d = rich({ calendar: cal, roles: ['despachante'] });
        maxDesp = Math.max(maxDesp, rollOrders(d).length);
      }
      check(max <= 2, 'no máximo 2 ofertas');
      check(maxDesp === 3, 'com Despachante chegam a 3');
      const c = rich({ calendar: 5 });
      checkEq(JSON.stringify(rollOrders(c)), JSON.stringify(rollOrders(cloneCampaign(c))), 'mesmo dia, mesmas ofertas');
    },
  },
  {
    id: 'campanha-aceitar-encomenda-e-aviso-de-insumo',
    rules: 'spec 4',
    run(seed) {
      let c = rich();
      let offer;
      for (let cal = 1; cal < 200 && !offer; cal++) {
        c = rich({ calendar: cal });
        offer = rollOrders(c)[0];
      }
      check(offer !== undefined, 'houve oferta');
      check(orderShortfall(c, offer!) === offer!.qty, 'sem estoque, falta tudo (aviso)');
      const r = acceptOrder(c, offer!.id);
      check(r.ok, 'aceita mesmo sem insumo');
      if (!r.ok) return;
      c = r.campaign;
      check(c.orders.length === 1, 'registrada');
      check(!rollOrders(c).some((o) => o.id === offer!.id), 'sai da lista de ofertas');
      check(!acceptOrder(c, offer!.id).ok, 'não aceita duas vezes');
      check(isCampaign(JSON.parse(JSON.stringify(c))), 'save válido com encomenda');
      const cfg = toDayConfig(c);
      checkEq(cfg.orders.length, 1, 'vai para o DayConfig');
      checkNear(cfg.orders[0].pickupAt, (offer!.hour - 7) * (240 / 7), 'horário em segundos do dia', 0.01);
      void buyIngredient;
      void hireRole;
      // o dia limpa as encomendas e cobra a multa se falhar
      const out = closeDay(c, runDay(seed, cfg).result()!);
      checkEq(out.campaign.orders.length, 0, 'encomendas valem só para o dia');
    },
  },
  {
    id: 'rn102-encomenda-exige-escritorio-e-delivery',
    rules: 'RN-102, CE-22',
    run() {
      let found = false;
      for (let cal = 1; cal <= 40 && !found; cal++) {
        const com = rich({ calendar: cal });
        const offers = rollOrders(com);
        if (offers.length === 0) continue;
        found = true;
        const sem = { ...com, owned: { ...com.owned, delivery: false } };
        checkEq(rollOrders(sem).length, 0, 'com escritório e sem delivery não há ofertas');
        const r = acceptOrder(sem, offers[0].id);
        check(!r.ok, 'nem aceite');
      }
      check(found, 'houve oferta com escritório e delivery');
    },
  },
  {
    id: 'rn102-aceite-automatico-ao-abrir-a-feira',
    rules: 'RN-102, RN-95',
    run() {
      let c: Campaign | undefined;
      for (let cal = 1; cal <= 200 && !c; cal++) {
        const x = rich({ calendar: cal });
        if (rollOrders(x).length > 0) c = x;
      }
      check(c, 'houve oferta');
      const fixo = { id: 1, name: 'Zé', kind: 'geral' as const, traits: [], courses: [], mode: 'fixo' as const, position: 'expedicao' as const, trainedToday: false };
      // estoque farto direto no inventário: o teste é da regra de aceite, não da capacidade de estoque
      const lots = ['massa', 'carne', 'mucarela', 'oregano', 'tomate', 'presunto', 'frango', 'catupiry', 'palmito', 'calabresa', 'cebola', 'azeitona', 'ovo']
        .map((ingredient) => ({ ingredient: ingredient as never, qty: 999, unitCost: 1, expires: c!.calendar + 3, inCooler: false }));
      const stocked: Campaign = { ...c, autoAccept: true, staff: [fixo], inventory: [...c.inventory, ...lots] };
      const offers = rollOrders(stocked);
      const auto = autoAcceptOrders(stocked);
      check(auto.orders.length > 0, 'com estoque, toggle e alguém fixo na Expedição, aceita sozinho');
      checkEq(auto.orders.length + rollOrders(auto).length, offers.length, 'aceitas saem das ofertas');
      checkEq(autoAcceptOrders({ ...stocked, autoAccept: false }).orders.length, 0, 'toggle desligado: manual');
      checkEq(autoAcceptOrders({ ...stocked, staff: [{ ...fixo, mode: 'auto' }] }).orders.length, 0, 'sem ninguém fixo na Expedição: manual');
      checkEq(autoAcceptOrders({ ...c, autoAccept: true, staff: [fixo] }).orders.length, 0, 'sem estoque que cubra: fica para o aceite manual');
    },
  },
];
