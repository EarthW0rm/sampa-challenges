import { defaultPrice } from '../../src/games/pastel-de-feira/game/campaign/pricing';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test, type GamePage } from './support/game';
import { assemble, deliver, fry, fryTimes, takeOrder } from './support/flow';

const ING = ['massa', 'mucarela', 'presunto', 'tomate', 'oregano'] as const;
const STOCK = { massa: 30, mucarela: 20, presunto: 20, tomate: 20, oregano: 10, carne: 10, cana: 10 };

/** Cardápio com Queijo, Pizza e Bauru (compradas e no cardápio). */
const SABORES = {
  stock: STOCK,
  patch: (c: Campaign): Campaign => ({
    ...c,
    owned: { ...c.owned, items: [...c.owned.items, 'pizza', 'bauru'] },
    menu: { ...c.menu, salgados: ['queijo', 'pizza', 'bauru'] },
    prices: { ...c.prices, pizza: defaultPrice('pizza'), bauru: defaultPrice('bauru') },
  }),
};

function stock(game: GamePage): Promise<Record<(typeof ING)[number], number>> {
  return game.hook((pf, ids) => {
    const q = (i: string) => pf.sim.state.stock.filter((l) => l.ingredient === i).reduce((n, l) => n + l.qty, 0);
    return Object.fromEntries(ids.map((i) => [i, q(i)])) as Record<string, number>;
  }, [...ING]) as Promise<Record<(typeof ING)[number], number>>;
}

/** RN-30 (receitas) e os selos de sabor (arte, passo 4a). */
test.describe('Receitas e selos de sabor', () => {
  test('RN-30: Queijo leva só muçarela; Pizza, tomate + muçarela + orégano; Bauru, muçarela + presunto + tomate', async ({ game }) => {
    await game.startDay({ campaign: SABORES });
    const s0 = await stock(game);
    await assemble(game, 'queijo');
    const s1 = await stock(game);
    expect(s1).toEqual({ ...s0, massa: s0.massa - 1, mucarela: s0.mucarela - 1 });
    await assemble(game, 'pizza');
    const s2 = await stock(game);
    expect(s2).toEqual({ ...s1, massa: s1.massa - 1, tomate: s1.tomate - 1, mucarela: s1.mucarela - 1, oregano: s1.oregano - 1 });
    await assemble(game, 'bauru');
    const s3 = await stock(game);
    expect(s3).toEqual({ ...s2, massa: s2.massa - 1, mucarela: s2.mucarela - 1, presunto: s2.presunto - 1, tomate: s2.tomate - 1 });
  });

  test('RN-30: a bancada mostra só os recheios das receitas do cardápio (o orégano entra sozinho)', async ({ game }) => {
    await game.startDay({ campaign: SABORES });
    await game.goTo('bancada');
    const labels = (await game.controls()).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['Muçarela', 'Presunto', 'Tomate']));
    expect(labels).not.toContain('Orégano');
  });

  test('Selos: o pastel montado no painel leva o selo do sabor; o ingrediente, o ícone do insumo', async ({ game }) => {
    await game.startDay({ campaign: SABORES });
    await assemble(game, 'pizza');
    const ctl = await game.controls();
    expect(ctl.find((c) => c.sub === 'MONTADO'), 'montado').toMatchObject({ icon: 'itens/pastel_salgado_cru', flavor: 'pizza' });
    expect(ctl.find((c) => c.label === 'Tomate'), 'ingrediente').toMatchObject({ icon: 'itens/ing_tomate' });
    expect(ctl.find((c) => c.label === 'Tomate')!.flavor).toBeUndefined();
  });

  test('Selos: o pastel pronto no balcão leva o selo do sabor do pedido e a entrega marca a linha', async ({ game }) => {
    await game.startDay({ campaign: SABORES });
    await game.waitCustomer();
    await takeOrder(game);
    const order = await game.hook((pf) => pf.sim.state.customers.find((c) => c.state === 'anotado')!.lines.map((l) => l.item));
    const pastel = order.find((i) => i !== 'caldo-puro')!;
    await assemble(game, pastel);
    const t = fryTimes(pastel);
    const p = await fry(game, (t.ponto[0] + t.ponto[1]) / 2);
    await game.goTo('balcao');
    const ctl = await game.controls();
    expect(ctl.find((c) => c.flavor === pastel), `pastel ${pastel} pronto no balcão`).toMatchObject({ icon: 'itens/pastel_salgado_ponto' });
    await deliver(game, { kind: 'pastel', id: p.id });
    // linha entregue: o cliente continua na fila com o pedido marcado
    const delivered = await game.hook((pf, item) => pf.sim.state.customers.some((c) => c.lines.some((l) => l.item === item && l.delivered !== null)) || pf.sim.state.stats.served > 0, pastel);
    expect(delivered).toBe(true);
  });

  test('Selos: o Cardápio do Preparo mostra o selo ao lado de cada receita', async ({ game, page }) => {
    await game.boot({ campaign: SABORES });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    for (const name of ['Queijo', 'Pizza', 'Bauru', 'Caldo puro']) {
      const row = page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });
      await expect(row.locator('img.item-icon'), name).toHaveAttribute('src', /sabor_/);
    }
  });
});
