import { CHARM_CHORINHO, CHARM_GIFT, QUALITY_FACTOR_MIN, QUALITY_FACTOR_SPAN, QUALITY_PONTO } from '../../src/games/pastel-de-feira/game/constants';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test } from './support/game';
import { collect, serveCustomer } from './support/flow';

const promo = (p: Partial<Campaign['promo']>) => ({ patch: (c: Campaign) => ({ ...c, promo: { ...c.promo, ...p } }) });

/** RN-120–125: brinde, chorinho e xepa. */
test.describe('Promoções', () => {
  test('RN-120/RN-122: pedido com N pastéis pagos ganha 1 de brinde; entregar o brinde dá +1,5 de encanto e não paga', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: promo({ brindeN: 2 }) });
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => c.place === 'fila' && c.lines.some((l) => l.gift)), 200, undefined, 30);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.place === 'fila' && k.lines.some((l) => l.gift))!;
      return { id: x.id, lines: x.lines.map((l) => ({ item: l.item, gift: !!l.gift })) };
    });
    const paid = c.lines.filter((l) => !l.gift && l.item !== 'caldo-puro');
    const gift = c.lines.find((l) => l.gift)!;
    expect(paid.length).toBeGreaterThanOrEqual(2);
    // brinde do mesmo sabor de menor preço do pedido (RN-120)
    expect(paid.map((l) => l.item)).toContain(gift.item);
    await serveCustomer(game, c.id);
    const r = await game.hook((pf) => ({ charm: pf.sim.state.rep.charm, giftCost: pf.sim.state.stats.giftCost, coins: pf.sim.state.coins.map((k) => k.amount) }));
    expect(r.charm).toBeCloseTo(CHARM_GIFT, 5);
    expect(r.giftCost).toBeGreaterThan(0);
    const prices = await game.hook((pf) => Object.fromEntries(pf.sim.state.config.menu.map((m) => [m.item, m.price])));
    const factor = QUALITY_FACTOR_MIN + (QUALITY_FACTOR_SPAN * QUALITY_PONTO) / 100;
    const expected = c.lines.filter((l) => !l.gift).reduce((n, l) => n + (l.item === 'caldo-puro' ? prices[l.item] : prices[l.item] * factor), 0);
    expect(r.coins.at(-1)).toBeCloseTo(expected, 1);
  });

  test('RN-122: o custo do brinde aparece separado no fechamento', async ({ game, page }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: promo({ brindeN: 2 }) });
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => c.place === 'fila' && c.lines.some((l) => l.gift)), 200, undefined, 30);
    const id = await game.hook((pf) => pf.sim.state.customers.find((k) => k.place === 'fila' && k.lines.some((l) => l.gift))!.id);
    await serveCustomer(game, id);
    await collect(game);
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary')).toContainText(/brinde/i);
  });

  test('RN-123: caldo com chorinho nível 2 dá +0,2 de encanto na entrega', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: promo({ chorinho: 2 }) });
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => c.place === 'fila' && c.lines.some((l) => l.item === 'caldo-puro')), 200, undefined, 30);
    const id = await game.hook((pf) => pf.sim.state.customers.find((k) => k.place === 'fila' && k.lines.some((l) => l.item === 'caldo-puro'))!.id);
    await serveCustomer(game, id);
    expect(await game.hook((pf) => pf.sim.state.rep.charm)).toBeCloseTo(2 * CHARM_CHORINHO, 5);
  });

  test('RN-124: depois das 13h, com xepa ligada, o pastel sai com o desconto escolhido', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: promo({ xepa: true, xepaDiscount: 0.3 }) });
    await game.advance((6 * 240) / 7 + 0.5); // 13h00
    await game.waitCustomer(30);
    const c = await game.hook((pf) => {
      const x = pf.queue()[0];
      const k = pf.sim.state.customers.find((y) => y.id === x.id)!;
      return { id: k.id, items: k.lines.map((l) => l.item) };
    });
    await serveCustomer(game, c.id);
    const prices = await game.hook((pf) => Object.fromEntries(pf.sim.state.config.menu.map((m) => [m.item, m.price])));
    const factor = QUALITY_FACTOR_MIN + (QUALITY_FACTOR_SPAN * QUALITY_PONTO) / 100;
    const expected = c.items.reduce((n, i) => n + (i === 'caldo-puro' ? prices[i] * 0.7 : prices[i] * 0.7 * factor), 0);
    expect(await game.hook((pf) => pf.sim.state.coins.at(-1)!.amount)).toBeCloseTo(expected, 1);
  });

  test('RN-125: com xepa ligada, os recheios que iam estragar são vendidos a 30% do custo', async ({ game, page }) => {
    await game.startDay({ campaign: promo({ xepa: true, xepaDiscount: 0.3 }) });
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary tr', { hasText: 'Sobras vendidas na xepa' })).toBeVisible();
  });
});
