import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test, type GamePage } from './support/game';
import { assemble, fry, tapBasket } from './support/flow';

// RN-102: quantidade de 10 a 40, retirada entre 9h e 13h30, pagamento ≈ 1,3× a referência, multa de 50%
const ORDER = { id: 'e2e-1', dayId: 9001, item: 'carne', qty: 10, hour: 9.5, pay: 104, fine: 52 };
const office = (c: Campaign): Campaign => ({
  ...c, day: 10, calendar: 10, cash: 3000,
  owned: { ...c.owned, office: true, extraM2: 4 },
  orders: [ORDER],
});
const PICKUP = ((ORDER.hour - 7) * 240) / 7;

/** Seleciona o pastel pronto no painel do balcão e toca em CAIXA (guarda na caixa da encomenda). */
async function box(game: GamePage, id: number): Promise<void> {
  await game.goTo('balcao');
  const ctl = await game.hook((pf, rid) => {
    const list = pf.controls();
    const base = list.findIndex((c) => c.label === 'VASSOURA') + 1;
    const ready = pf.sim.state.ready.filter((x) => x.reservedFor === undefined).slice(0, 7);
    return list[base + ready.findIndex((r) => r.id === rid)];
  }, id);
  await game.tapAt(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2);
  await game.frames(1);
  await game.tapControl('CAIXA');
}

/** RN-100–104: escritório, encomendas e caixa de encomenda. */
test.describe('Escritório e encomendas', () => {
  test('RN-100: com escritório, a aba Escritório aparece no Preparo e a zona no dia', async ({ game, page }) => {
    await game.boot({ campaign: { patch: office } });
    await game.continueToPrep();
    await expect(page.getByRole('tab', { name: 'Escritório' })).toBeVisible();
    await game.openFair();
    expect(await game.hook((pf) => pf.env.layout.zones.map((z) => z.id))).toContain('escritorio');
  });

  test('RN-104: encomenda completa na caixa é entregue no horário e paga', async ({ game }) => {
    await game.startDay({ campaign: { patch: office } });
    // de 2 em 2 (os 2 cestos do tacho pequeno)
    for (let i = 0; i < ORDER.qty; i += 2) {
      await assemble(game, 'carne');
      await assemble(game, 'carne');
      await tapBasket(game, 0);
      await game.tapControl('CESTO 2');
      await game.frames(Math.round(6.4 * 60));
      await game.goTo('tacho1');
      await game.tapControl('CESTO 1');
      await game.tapControl('CESTO 2');
      const ids = await game.hook((pf) => pf.sim.state.ready.filter((r) => r.reservedFor === undefined).map((r) => r.id));
      for (const id of ids) await box(game, id);
    }
    expect(await game.hook((pf) => pf.sim.state.bigOrders[0].boxed.length)).toBe(ORDER.qty);
    await game.goTo('balcao');
    await game.advanceUntil((pf) => pf.sim.state.stats.encDone > 0, PICKUP + 5, undefined, 30);
    expect(await game.hook((pf) => ({ rev: pf.sim.state.stats.orderRevenue, failed: pf.sim.state.stats.encFailed }))).toEqual({ rev: ORDER.pay, failed: 0 });
  });

  test('RN-104: encomenda incompleta quando o cliente vai embora = multa e falha de peso 3', async ({ game, page }) => {
    await game.startDay({ campaign: { patch: office } });
    await game.advance(PICKUP + 30.5);
    expect(await game.hook((pf) => ({ fines: pf.sim.state.stats.fines, failed: pf.sim.state.stats.encFailed }))).toEqual({ fines: ORDER.fine, failed: 1 });
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary tr', { hasText: 'Multas de encomenda' })).toContainText('R$ 52,00');
  });

  test('RN-104: a caixa de encomenda não ocupa a estufa e congela a nota por 60 s', async ({ game }) => {
    await game.startDay({ campaign: { patch: office } });
    await assemble(game, 'carne');
    const p = await fry(game, 6.5);
    await box(game, p.id);
    await game.advance(50);
    const q = await game.hook((pf, id) => {
      const r = pf.sim.state.ready.find((x) => x.id === id)!;
      return { boxed: r.boxed, warmed: !!r.warmed, quality: r.quality, waited: pf.sim.state.tick / 60 - r.readyAt };
    }, p.id);
    expect(q.boxed).toBe(true);
    expect(q.warmed).toBe(false);
    expect(q.waited).toBeLessThan(60);
    expect(q.quality).toBe(80);
  });
});
