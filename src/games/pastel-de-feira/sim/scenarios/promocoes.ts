import { STEP } from '../../game/constants';
import { giftFor, spawnCustomer, addCustomer } from '../../game/sim/customers';
import { deliverItem } from '../../game/sim/stations/counter';
import { stockQty } from '../../game/sim/stock';
import type { DayConfig } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';
import { devConfig } from '../testConfig';
import { acceptOffer } from '../../game/sim/delivery';
import { appSim } from './delivery';

const secs = (n: number): number => Math.round(n / STEP);

const promoConfig = (promo: Partial<DayConfig['promo']>, patch: Partial<DayConfig> = {}): DayConfig =>
  devConfig({
    promo: { brindeN: 0, chorinho: 0, xepa: false, xepaDiscount: 0.3, ...promo },
    menu: [{ item: 'carne', price: 6 }, { item: 'queijo', price: 5.5 }, { item: 'caldo-puro', price: 5 }],
    stock: [
      { ingredient: 'massa', qty: 9999, daysLeft: 3 },
      { ingredient: 'carne', qty: 9999, daysLeft: 1 },
      { ingredient: 'mucarela', qty: 9999, daysLeft: 1 },
      { ingredient: 'oregano', qty: 9999, daysLeft: 1 },
      { ingredient: 'cana', qty: 9999, daysLeft: 1 },
    ],
    consumables: { copo: 9999, saquinho: 9999, embalagem: 20 },
    ...patch,
  });

function promoSim(seed: number, promo: Partial<DayConfig['promo']>, patch: Partial<DayConfig> = {}) {
  const sim = makeSim(seed, promoConfig(promo, patch));
  sim.state.arrivalLeft = 1e9;
  return sim;
}

export const promocoes: Scenario[] = [
  {
    id: 'rn120-brinde-a-cada-n',
    rules: 'RN-120, PA-09',
    run(seed) {
      const sim = promoSim(seed, { brindeN: 2 });
      const s = sim.state;
      checkEq(giftFor(s, ['carne', 'queijo']), 'queijo', 'N = 2: pedido de 2 pastéis ganha o de menor preço');
      checkEq(giftFor(s, ['carne']), null, 'abaixo de N não ganha');
      checkEq(giftFor(s, ['carne', 'caldo-puro']), null, 'caldo não conta como pastel');
      checkEq(giftFor(promoSim(seed, {}).state, ['carne', 'queijo']), null, 'desligado');
      checkEq(giftFor(promoSim(seed, { brindeN: 3 }).state, ['carne', 'queijo']), null, 'N = 3 com 2 pastéis: nada');
    },
  },
  {
    id: 'rn122-brinde-so-fecha-com-ele-e-da-encanto',
    rules: 'RN-122, RN-62',
    run(seed) {
      const sim = promoSim(seed, { brindeN: 2 });
      const s = sim.state;
      let c: ReturnType<typeof addCustomer> | undefined;
      for (let i = 0; i < 200 && !c; i++) {
        s.customers.length = 0;
        spawnCustomer(s, 'padrao');
        const found = s.customers.find((x) => x.lines.some((l) => l.gift));
        if (found && !found.group) c = found;
      }
      check(c !== undefined, 'pedido com brinde');
      const gifts = c!.lines.filter((l) => l.gift).length;
      checkEq(gifts, 1, 'um brinde');
      c!.state = 'anotado';
      let id = 100;
      const paid = c!.lines.filter((l) => !l.gift);
      for (const l of paid) {
        if (l.item === 'caldo-puro') s.cups.push({ id: ++id, item: l.item });
        else s.ready.push({ id: ++id, item: l.item, quality: 90, readyAt: s.tick * STEP });
        deliverItem(s, { kind: l.item === 'caldo-puro' ? 'copo' : 'pastel', id }, c!.id);
      }
      check(s.customers.includes(c!), 'o pedido só fecha com o brinde entregue');
      checkEq(s.rep.charm, 0, 'sem encanto antes do brinde');
      const g = c!.lines.find((l) => l.gift)!;
      s.ready.push({ id: ++id, item: g.item, quality: 90, readyAt: s.tick * STEP });
      deliverItem(s, { kind: 'pastel', id }, c!.id);
      check(!s.customers.includes(c!), 'fechou');
      checkNear(s.rep.charm, 0.5, 'brinde entregue: +0,5 de encanto');
      checkNear(s.stats.giftCost > 0 ? 1 : 0, 1, 'custo do brinde registrado');
      checkEq(s.stats.wrong, 0, 'sem erro');
      const dinheiro = c!.owed;
      checkNear(s.coins[0].amount, Math.round(dinheiro * 100) / 100, 'o brinde não paga');
    },
  },
  {
    id: 'rn121-pedidos-crescem-ate-n',
    rules: 'RN-121',
    run(seed) {
      const maior = (promo: Partial<DayConfig['promo']>): number => {
        const sim = promoSim(seed, promo);
        const s = sim.state;
        let total = 0;
        let n = 0;
        for (let i = 0; i < 1500; i++) {
          s.customers.length = 0;
          spawnCustomer(s, 'padrao');
          const c = s.customers[0];
          if (c) {
            total += c.lines.filter((l) => !l.gift && l.item !== 'caldo-puro').length;
            n++;
          }
        }
        return total / n;
      };
      const base = maior({});
      const n3 = maior({ brindeN: 3 });
      const n5 = maior({ brindeN: 5 });
      check(n3 > base + 0.2, `com N = 3 a média sobe (${base.toFixed(2)} → ${n3.toFixed(2)})`);
      check(n5 > base, 'com N = 5 também sobe, menos');
    },
  },
  {
    id: 'rn123-chorinho',
    rules: 'RN-123, PA-10',
    run(seed) {
      const sim = promoSim(seed, { chorinho: 3 });
      const s = sim.state;
      sim.dispatch({ type: 'tapStation', station: 'moenda' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'holdStart', station: 'moenda', action: 'moenda' });
      advance(sim, secs(6.8));
      checkEq(s.cups.length, 0, 'mais lento: 6 s + 0,9 s');
      advance(sim, secs(0.3));
      checkEq(s.cups.length, 1, 'copo pronto aos 6,9 s');
      checkNear(9999 - stockQty(s, 'cana'), 1.3, 'consome 1,3 dose de cana por copo', 1e-6);
      // encanto na entrega: +0,1 por nível
      const c = addCustomer(s, 'padrao', ['caldo-puro']);
      c.state = 'anotado';
      deliverItem(s, { kind: 'copo', id: s.cups[0].id }, c.id);
      checkNear(s.rep.charm, 0.3, 'chorinho 3: +0,3 de encanto');
    },
  },
  {
    id: 'rn120-brinde-no-app-sem-mudar-a-comanda',
    rules: 'RN-120, PA-09',
    run(seed) {
      const sim = appSim(seed);
      sim.state.config.promo = { brindeN: 2, chorinho: 0, xepa: false, xepaDiscount: 0.3 };
      sim.state.offers.push({ id: 1, items: ['carne', 'queijo'], left: 10 });
      check(acceptOffer(sim.state, 1), 'aceitou');
      const c = sim.state.comandas[0];
      checkEq(c.items.length, 3, 'a comanda ganhou 1 brinde');
      checkEq(c.gifts.filter(Boolean).length, 1, 'marcado como brinde');
      sim.state.ready.push({ id: 1, item: 'carne', quality: 90, readyAt: 0 }, { id: 2, item: 'queijo', quality: 90, readyAt: 0 }, { id: 3, item: c.items[2], quality: 90, readyAt: 0 });
    },
  },
  {
    id: 'brinde-sem-insumo-usa-tradicional-de-1-etapa',
    rules: 'spec 4',
    run(seed) {
      const sim = promoSim(seed, { brindeN: 2 }, {
        stock: [
          { ingredient: 'massa', qty: 50, daysLeft: 3 },
          { ingredient: 'carne', qty: 50, daysLeft: 1 },
          { ingredient: 'cana', qty: 50, daysLeft: 1 },
        ],
      });
      const g = giftFor(sim.state, ['carne', 'queijo']);
      checkEq(g, 'carne', 'queijo sem insumo: o brinde sai de outro tradicional de 1 etapa disponível');
      const nada = promoSim(seed, { brindeN: 2 }, { stock: [{ ingredient: 'cana', qty: 5, daysLeft: 1 }] });
      checkEq(giftFor(nada.state, ['carne', 'queijo']), null, 'sem nenhum disponível, o brinde é dispensado');
    },
  },
];
