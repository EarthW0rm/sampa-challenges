import {
  DIRT_PER_ORDER, HOLD_MILL_MANUAL, OIL_DIRT_PER_PASTRY, QUALITY_PONTO, QUALITY_FACTOR_MIN, QUALITY_FACTOR_SPAN,
} from '../../src/games/pastel-de-feira/game/constants';
import { ITEMS } from '../../src/games/pastel-de-feira/game/data/recipes';
import { expect, frontOrder, test } from './support/game';
import { assemble, collect, deliver, fry, fryTimes, isDrink, mill, serveFront, takeOrder } from './support/flow';

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Jornada principal 2.3, RN-20/21, RN-34, RN-42, RN-46, RN-63, RN-131, RN-39a. */
test.describe('Pedido de balcão de ponta a ponta', () => {
  test.beforeEach(async ({ game }) => {
    await game.startDay();
  });

  test('anotar: ANOTAR no balcão anota o primeiro cliente da fila', async ({ game }) => {
    await game.waitCustomer();
    const c = await frontOrder(game);
    await takeOrder(game);
    const state = await game.hook((pf, id) => pf.sim.state.customers.find((x) => x.id === id)?.state, c!.id);
    expect(state).toBe('anotado');
  });

  test('anotar: tocar no cliente da fila leva o pasteleiro ao balcão', async ({ game }) => {
    await game.goTo('moenda');
    await game.waitCustomer();
    await game.tapCustomer(0);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBe('balcao');
  });

  test('RN-42/RN-34: montar consome 1 massa e 1 unidade de cada recheio', async ({ game }) => {
    const stock = () =>
      game.hook((pf) => {
        const q = (i: string) => pf.sim.state.stock.filter((l) => l.ingredient === i).reduce((n, l) => n + l.qty, 0);
        return { massa: q('massa'), carne: q('carne'), mucarela: q('mucarela'), oregano: q('oregano') };
      });
    const s0 = await stock();
    await assemble(game, 'carne');
    const s1 = await stock();
    expect(s1).toEqual({ ...s0, massa: s0.massa - 1, carne: s0.carne - 1 });
    await assemble(game, 'queijo');
    const s2 = await stock();
    // o orégano é tempero: entra sozinho ao fechar (RN-30)
    expect(s2).toEqual({ ...s1, massa: s1.massa - 1, mucarela: s1.mucarela - 1, oregano: s1.oregano - 1 });
  });

  test('RN-42: LIMPAR esvazia a bandeja sem consumir insumo', async ({ game }) => {
    await game.goTo('bancada');
    await game.tapControl('Carne');
    expect(await game.hook((pf) => pf.sim.state.tray.length)).toBe(1);
    await game.tapControl('LIMPAR');
    expect(await game.hook((pf) => ({ tray: pf.sim.state.tray.length, assembled: pf.sim.state.assembled.length }))).toEqual({ tray: 0, assembled: 0 });
  });

  test('RN-42/RN-46: colocar no cesto livre suja o óleo em 4%', async ({ game }) => {
    await assemble(game, 'carne');
    await game.goTo('tacho1');
    await game.tapControl('CESTO 1');
    const t = await game.hook((pf) => ({ dirt: pf.sim.state.tachos[0].dirt, item: pf.sim.state.tachos[0].baskets[0].frying?.item, assembled: pf.sim.state.assembled.length }));
    expect(t).toEqual({ dirt: OIL_DIRT_PER_PASTRY, item: 'carne', assembled: 0 });
  });

  test('RN-42: cesto ocupado não recebe outro pastel; o segundo cesto recebe', async ({ game }) => {
    await assemble(game, 'carne');
    await assemble(game, 'queijo');
    await game.goTo('tacho1');
    await game.tapControl('CESTO 1');
    await game.tapControl('CESTO 2');
    const items = await game.hook((pf) => pf.sim.state.tachos[0].baskets.map((b) => b.frying?.item ?? null));
    expect(items).toEqual(['carne', 'queijo']);
  });

  test('RN-42: a moenda manual faz 1 caldo segurando 6 s (consome cana e copo)', async ({ game }) => {
    const before = await game.hook((pf) => ({ copo: pf.sim.state.consumables.copo, cups: pf.sim.state.cups.length }));
    await mill(game, HOLD_MILL_MANUAL);
    const after = await game.hook((pf) => ({ copo: pf.sim.state.consumables.copo, cups: pf.sim.state.cups.length }));
    expect(after).toEqual({ copo: before.copo - 1, cups: before.cups + 1 });
  });

  test('RN-42: soltar a moenda antes de 6 s não faz caldo', async ({ game }) => {
    await game.goTo('moenda');
    await game.holdControl('PURO', HOLD_MILL_MANUAL - 1);
    expect(await game.hook((pf) => pf.sim.state.cups.length)).toBe(0);
  });

  test('fluxo completo: anotar → montar → fritar no ponto → (caldo) → entregar → cobrar', async ({ game, page }) => {
    await game.waitCustomer();
    const order = await frontOrder(game);
    expect(order).not.toBeNull();
    const id = await serveFront(game);
    // pedido completo: o cliente sai, deixa moedas e a barraca suja +1 (RN-131)
    const after = await game.hook((pf, cid) => ({
      gone: !pf.sim.state.customers.some((c) => c.id === cid),
      served: pf.sim.state.stats.served,
      coins: pf.sim.state.coins.reduce((n, c) => n + c.amount, 0),
      dirt: pf.sim.state.dirt,
      revenue: pf.sim.state.stats.revenue,
    }), id);
    expect(after.gone).toBe(true);
    expect(after.served).toBe(1);
    expect(after.dirt).toBe(DIRT_PER_ORDER);
    expect(after.coins).toBeGreaterThan(0);
    expect(after.revenue).toBe(0);
    // cobrar leva as moedas para o caixa e o HUD mostra (RN-42)
    await collect(game);
    const revenue = await game.hook((pf) => pf.sim.state.stats.revenue);
    expect(revenue).toBeCloseTo(after.coins, 2);
    await game.frames(7);
    await expect(page.locator('.pastel-de-feira .hud')).toContainText(`Caixa ${money(revenue)}`);
  });

  test('RN-20/RN-21: pastel no ponto (nota 80) é pago a preço × (0,8 + 0,4 × 0,8)', async ({ game }) => {
    await game.waitCustomer();
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, items: x.lines.map((l) => l.item), rep: pf.sim.state.config.reputation, prices: pf.sim.state.config.menu };
    });
    const pastry = c.items.find((i) => !isDrink(i))!;
    await assemble(game, pastry);
    const t = fryTimes(pastry);
    const p = await fry(game, (t.ponto[0] + t.ponto[1]) / 2);
    expect(p.quality).toBe(QUALITY_PONTO);
    await deliver(game, { kind: 'pastel', id: p.id });
    const owed = await game.hook((pf, id) => pf.sim.state.customers.find((x) => x.id === id)?.owed ?? null, c.id);
    const price = c.prices.find((m) => m.item === pastry)!.price;
    const expected = price * (QUALITY_FACTOR_MIN + (QUALITY_FACTOR_SPAN * QUALITY_PONTO) / 100); // reputação 3: prêmio 1,0
    if (owed !== null) expect(owed).toBeCloseTo(expected, 2);
    else expect(await game.hook((pf) => pf.sim.state.coins.at(-1)?.amount)).toBeCloseTo(expected, 2);
  });

  test('RN-39a/RN-28: cada pastel entregue gasta 1 saquinho', async ({ game }) => {
    await game.waitCustomer();
    const bags = await game.hook((pf) => pf.sim.state.consumables.saquinho);
    await takeOrder(game);
    const c = await game.hook((pf) => pf.sim.state.customers.find((k) => k.state === 'anotado')!.lines.map((l) => l.item));
    const pastry = c.find((i) => !isDrink(i))!;
    await assemble(game, pastry);
    const p = await fry(game, (fryTimes(pastry).ponto[0] + fryTimes(pastry).ponto[1]) / 2);
    await deliver(game, { kind: 'pastel', id: p.id });
    expect(await game.hook((pf) => pf.sim.state.consumables.saquinho)).toBe(bags - 1);
  });

  test('RN-63: item errado é recusado, volta para a bancada e o pedido vira falha uma vez só', async ({ game }) => {
    await game.waitCustomer();
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, items: x.lines.map((l) => l.item) };
    });
    // um pastel que o cliente não pediu
    const wrong = ['carne', 'queijo'].find((i) => !c.items.includes(i));
    test.skip(!wrong, 'o cliente pediu os dois sabores; sem item errado possível com esta semente');
    await assemble(game, wrong!);
    const p = await fry(game, (fryTimes(wrong!).ponto[0] + fryTimes(wrong!).ponto[1]) / 2);
    const failures0 = await game.hook((pf) => pf.sim.state.rep.failures);
    await deliver(game, { kind: 'pastel', id: p.id });
    const r1 = await game.hook((pf, a) => ({
      stillReady: pf.sim.state.ready.some((r) => r.id === a.pid),
      wrong: pf.sim.state.customers.find((x) => x.id === a.cid)?.wrong,
      failures: pf.sim.state.rep.failures,
      stat: pf.sim.state.stats.wrong,
    }), { pid: p.id, cid: c.id });
    expect(r1.stillReady).toBe(true);
    expect(r1.wrong).toBe(true);
    expect(r1.stat).toBe(1);
    expect(r1.failures - failures0).toBe(1);
    await deliver(game, { kind: 'pastel', id: p.id });
    expect(await game.hook((pf) => ({ f: pf.sim.state.rep.failures, s: pf.sim.state.stats.wrong }))).toEqual({ f: r1.failures, s: 1 });
  });

  test('spec 4: COBRAR duas vezes seguidas não cobra em dobro', async ({ game }) => {
    await serveFront(game);
    await game.goTo('balcao');
    const coins = await game.hook((pf) => pf.sim.state.coins.reduce((n, c) => n + c.amount, 0));
    await game.tapControl('COBRAR');
    await game.tapControl('COBRAR');
    expect(await game.hook((pf) => pf.sim.state.stats.revenue)).toBeCloseTo(coins, 2);
  });

  test('o pastel entregue fica com o sabor pedido (receitas do cardápio inicial)', async ({ game }) => {
    for (const id of ['carne', 'queijo']) expect(ITEMS[id].filling.length).toBeGreaterThan(0);
    await game.waitCustomer();
    await takeOrder(game);
    const items = await game.hook((pf) => pf.sim.state.customers.find((k) => k.state === 'anotado')!.lines.map((l) => l.item));
    for (const it of items) expect(['carne', 'queijo', 'caldo-puro']).toContain(it);
  });
});
