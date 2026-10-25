import { APP_PICKUP_DELAY, APP_MOTO_WAIT, EAT_SECONDS, HOLD_CLEAN_TABLE } from '../../src/games/pastel-de-feira/game/constants';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test } from './support/game';
import { assemble, collect, fry, serveCustomer } from './support/flow';

const withTables = (c: Campaign): Campaign => ({ ...c, cash: 2000, owned: { ...c.owned, tables: 2, extraM2: 4 } });
const withDelivery = (c: Campaign): Campaign => ({
  ...c, day: 5, calendar: 5, cash: 2000, deliveryOn: true,
  consumables: { ...c.consumables, embalagem: 10 },
  owned: { ...c.owned, delivery: true, extraM2: 3 },
});

/** RN-81–87 (mesas) e RN-90–96 (delivery). */
test.describe('Mesas', () => {
  test('RN-81/RN-83/RN-87: grupo de mesa sem garçom pede no balcão, come 25 s, paga na fila de pagamento e deixa a mesa suja', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withTables } });
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => !!c.group && c.place === 'fila'), 240, undefined, 30);
    const g = await game.hook((pf) => {
      const c = pf.sim.state.customers.find((x) => !!x.group && x.place === 'fila')!;
      return { id: c.id, table: c.group!.table, seats: c.group!.seats };
    });
    const seats = await game.hook((pf, a) => a.seats.map((i) => pf.sim.state.tables[a.table].seats[i]), g);
    expect(seats.every((x) => x === 'ocupado')).toBe(true);
    await serveCustomer(game, g.id);
    expect(await game.hook((pf, id) => pf.sim.state.eating.some((c) => c.id === id), g.id)).toBe(true);
    await game.advance(EAT_SECONDS + 0.1);
    const after = await game.hook((pf, a) => ({ inPay: pf.sim.state.payQueue.some((c) => c.id === a.id), seats: a.seats.map((i) => pf.sim.state.tables[a.table].seats[i]) }), g);
    expect(after.inPay).toBe(true);
    expect(after.seats.every((x) => x === 'sujo')).toBe(true);
    const rev0 = await game.hook((pf) => pf.sim.state.stats.revenue);
    await game.goTo('balcao');
    await game.tapControl('PAGAR');
    const r = await game.hook((pf) => ({ rev: pf.sim.state.stats.revenue, table: pf.sim.state.stats.tableRevenue, q: pf.sim.state.payQueue.length }));
    expect(r.rev).toBeGreaterThan(rev0);
    expect(r.table).toBeGreaterThan(0);
    // RN-84: o pasteleiro limpa a mesa segurando 3 s
    await game.goTo('mesas');
    await game.holdControl('LIMPAR', HOLD_CLEAN_TABLE + 0.05);
    const clean = await game.hook((pf, a) => pf.sim.state.tables[a.table].seats, g);
    expect(clean.includes('sujo')).toBe(false);
  });
});

test.describe('Delivery', () => {
  test('RN-91: a oferta aparece na faixa de avisos e um toque nela aceita (gasta 1 embalagem)', async ({ game }) => {
    await game.startDay({ campaign: { patch: withDelivery } });
    expect(await game.hook((pf) => pf.env.layout.zones.map((z) => z.id))).toContain('expedicao');
    await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 60, undefined, 30);
    await game.tapAt(320, 10);
    await game.frames(1);
    const r = await game.hook((pf) => ({ comandas: pf.sim.state.comandas.length, emb: pf.sim.state.consumables.embalagem, offers: pf.sim.state.offers.length }));
    expect(r).toEqual({ comandas: 1, emb: 9, offers: 0 });
  });

  test('RN-91: oferta ignorada expira em 10 s sem penalidade', async ({ game }) => {
    await game.startDay({ campaign: { patch: withDelivery } });
    await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 60, undefined, 30);
    const id = await game.hook((pf) => pf.sim.state.offers[0].id);
    await game.advance(10.1);
    const r = await game.hook((pf, oid) => ({ gone: !pf.sim.state.offers.some((o) => o.id === oid), f: pf.sim.state.rep.failures }), id);
    expect(r.gone).toBe(true);
    expect(r.f).toBe(0);
  });

  test('RN-92/RN-94: comanda não pronta quando o motoboy sai é cancelada (falha 3,0)', async ({ game }) => {
    await game.startDay({ campaign: { patch: withDelivery } });
    await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 60, undefined, 30);
    await game.tapAt(320, 10);
    await game.frames(1);
    const f0 = await game.hook((pf) => pf.sim.state.rep.failures);
    await game.advance(APP_PICKUP_DELAY + APP_MOTO_WAIT + 1);
    const r = await game.hook((pf) => ({ cancelled: pf.sim.state.stats.appCancelled, f: pf.sim.state.rep.failures }));
    expect(r.cancelled).toBe(1);
    expect(r.f - f0).toBeGreaterThanOrEqual(3);
  });

  test('RN-93/RN-96: comanda completa é retirada pelo motoboy e paga com 20% de taxa', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withDelivery } });
    await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 60, undefined, 30);
    await game.tapAt(320, 10);
    await game.frames(1);
    const items = await game.hook((pf) => pf.sim.state.comandas[0].items);
    for (const item of items) {
      await assemble(game, item);
      const p = await fry(game, 6.5);
      await game.goTo('expedicao');
      const ctl = await game.hook((pf, id) => {
        const list = pf.controls();
        const ready = pf.sim.state.ready.filter((x) => x.reservedFor === undefined).slice(0, 6);
        return list[2 + ready.findIndex((r) => r.id === id)];
      }, p.id);
      await game.tapAt(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2);
      await game.frames(1);
    }
    expect(await game.hook((pf) => pf.sim.state.comandas[0].packed.every((x) => x !== null))).toBe(true);
    await game.advanceUntil((pf) => pf.sim.state.stats.appPicked > 0, APP_PICKUP_DELAY + APP_MOTO_WAIT, undefined, 30);
    const r = await game.hook((pf) => ({ app: pf.sim.state.stats.appRevenue, cancelled: pf.sim.state.stats.appCancelled }));
    expect(r.cancelled).toBe(0);
    expect(r.app).toBeGreaterThan(0);
    void collect;
  });
});
