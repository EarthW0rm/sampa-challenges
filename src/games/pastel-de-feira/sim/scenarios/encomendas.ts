import { STEP } from '../../game/constants';
import { acceptOrder, orderShortfall, rollOrders } from '../../game/campaign/actions/orders';
import { buyIngredient } from '../../game/campaign/actions/inventory';
import { buyOffice, buySpace, hireRole } from '../../game/campaign/actions/upgrades';
import { cloneCampaign, newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { isCampaign } from '../../game/campaign/save';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import { unmetItems } from '../../game/sim/demand';
import { boxPastry } from '../../game/sim/orders';
import { currentQuality } from '../../game/sim/quality';
import { warmedCount } from '../../game/sim/stations/warmer';
import type { OrderConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, runDay, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

const order = (patch: Partial<OrderConfig> = {}): OrderConfig => ({ id: 7, item: 'carne', qty: 20, pickupAt: 60, pay: 208, fine: 104, ...patch });

function orderSim(seed: number, o: OrderConfig = order(), staff = devConfig().staff) {
  const sim = makeSim(seed, devConfig({ orders: [o], staff, stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'escritorio'] }));
  sim.state.arrivalLeft = 1e9;
  sim.state.offerLeft = 1e9;
  return sim;
}

function boxN(sim: ReturnType<typeof orderSim>, n: number, quality = 90) {
  for (let i = 0; i < n; i++) {
    sim.state.ready.push({ id: 100 + i, item: 'carne', quality, readyAt: sim.state.tick * STEP });
    check(boxPastry(sim.state, 100 + i), `encaixotou ${i + 1}`);
  }
}

const rich = (patch: Partial<Campaign> = {}): Campaign => {
  let c: Campaign = { ...newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 15 }), cash: 20000, day: 10, ...patch };
  const r1 = buySpace(c, 4) as ActionResult;
  if (r1.ok) c = r1.campaign;
  const r2 = buyOffice(c);
  if (r2.ok) c = r2.campaign;
  return c;
};

export const encomendas: Scenario[] = [
  {
    id: 'rn104-encomenda-completa-paga-1-3x',
    rules: 'RN-102, RN-104',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'balcao';
      boxN(sim, 20);
      advance(sim, secs(59));
      checkEq(sim.state.bigOrders[0].state, 'pendente', 'o cliente ainda não chegou');
      advance(sim, secs(2));
      checkEq(sim.state.stats.encDone, 1, 'entregue quando o cliente chega e o balcão atende');
      checkNear(sim.state.stats.orderRevenue, 20 * 8 * 1.3, '20 pastéis a 1,3 × a referência');
      checkEq(sim.state.rep.successes, 1, 'sucesso');
      checkEq(sim.state.ready.length, 0, 'caixa esvaziada');
      checkEq(warmedCount(sim.state), 0, 'a encomenda não usa a estufa');
    },
  },
  {
    id: 'rn104-incompleta-multa-e-falha',
    rules: 'RN-104, RN-61',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'balcao';
      boxN(sim, 19);
      advance(sim, secs(60 + 29));
      checkEq(sim.state.bigOrders.length, 1, 'o cliente espera 30 s');
      advance(sim, secs(2));
      checkEq(sim.state.bigOrders.length, 0, 'foi embora');
      checkNear(sim.state.stats.fines, 104, 'multa de 50% do pagamento');
      checkNear(sim.state.rep.failures, 3, 'falha de peso 3,0');
      checkNear(sim.state.stats.orderRevenue, 0, 'sem pagamento');
      checkEq(sim.state.stats.encFailed, 1, 'contado');
    },
  },
  {
    id: 'rn104-completar-durante-a-espera',
    rules: 'RN-104',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'balcao';
      boxN(sim, 19);
      advance(sim, secs(60 + 20));
      sim.state.ready.push({ id: 999, item: 'carne', quality: 90, readyAt: sim.state.tick * STEP });
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'encomenda', id: 999 } });
      advance(sim, 3);
      checkEq(sim.state.stats.encDone, 1, 'completada a tempo');
      checkNear(sim.state.stats.fines, 0, 'sem multa');
    },
  },
  {
    id: 'rn104-sem-atendente-a-encomenda-espera',
    rules: 'RN-104',
    run(seed) {
      const sim = orderSim(seed); // pasteleiro em 'balcao' por padrão; manda-o embora
      sim.state.pasteleiro.at = 'escritorio';
      boxN(sim, 20);
      advance(sim, secs(75));
      checkEq(sim.state.stats.encDone, 0, 'ninguém no balcão nem na expedição');
      sim.dispatch({ type: 'tapStation', station: 'balcao' });
      advance(sim, secs(3));
      checkEq(sim.state.stats.encDone, 1, 'o pasteleiro chega e entrega dentro dos 30 s');
    },
  },
  {
    id: 'rn104-funcionario-no-balcao-entrega',
    rules: 'RN-104',
    run(seed) {
      const sim = orderSim(seed, order(), [member('geral', { mode: 'fixo', position: 'balcao' })]);
      sim.state.pasteleiro.at = 'escritorio';
      sim.step();
      boxN(sim, 20);
      advance(sim, secs(62));
      checkEq(sim.state.stats.encDone, 1, 'o Balcão entrega');
    },
  },
  {
    id: 'rn104-nota-congelada-60s-depois-cai-1-por-s',
    rules: 'RN-104',
    run(seed) {
      const sim = orderSim(seed);
      sim.state.pasteleiro.at = 'escritorio';
      boxN(sim, 1, 80);
      const r = sim.state.ready[0];
      checkEq(r.boxed, true, 'na caixa');
      const t0 = r.readyAt;
      checkEq(currentQuality(r, t0 + 59), 80, 'congelada por 60 s');
      checkEq(currentQuality(r, t0 + 70), 70, 'depois cai 1 ponto por segundo');
    },
  },
  {
    id: 'encomenda-entra-na-demanda-de-producao',
    rules: 'RN-102',
    run(seed) {
      const sim = orderSim(seed, order({ qty: 12 }));
      checkEq(unmetItems(sim.state, false).length, 12, 'os 12 pastéis precisam ser produzidos');
      boxN(sim, 5);
      checkEq(unmetItems(sim.state, false).length, 7, 'os encaixotados já contam');
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
];
