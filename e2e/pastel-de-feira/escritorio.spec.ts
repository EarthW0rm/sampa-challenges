import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { currentQuality } from '../../src/games/pastel-de-feira/game/sim/quality';
import { expect, test, type GamePage } from './support/game';
import { assemble, fry, pack, tapBasket } from './support/flow';

// RN-102: quantidade de 10 a 40, retirada entre 9h e 13h30, pagamento ≈ 1,3× a referência, multa de 50%
const ORDER = { id: 'e2e-1', dayId: 9001, item: 'carne', qty: 10, hour: 9.5, pay: 104, fine: 52 };
// encomenda exige escritório e área de delivery (RN-102): a Expedição monta a caixa e atende o cliente
const office = (c: Campaign): Campaign => ({
  ...c, day: 10, calendar: 10, cash: 3000, deliveryOn: false,
  owned: { ...c.owned, office: true, delivery: true, extraM2: 7 },
  orders: [ORDER],
});
const PICKUP = ((ORDER.hour - 7) * 240) / 7;

/** Rótulo da comanda E da encomenda (RN-180). */
const orderLabel = (game: GamePage) => game.hook((pf) => pf.tickets().find((t) => t.kind === 'encomenda')!.label);

/** Põe o pastel pronto na caixa da encomenda pela Expedição (RN-104, RN-183). */
async function box(game: GamePage, id: number): Promise<void> {
  await pack(game, id, await orderLabel(game));
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
      const ids = await game.hook((pf) => pf.sim.state.ready.map((r) => r.id));
      for (const id of ids) await box(game, id);
    }
    expect(await game.hook((pf) => pf.tickets().find((t) => t.kind === 'encomenda')!.slots.filter((x) => x.filled).length)).toBe(ORDER.qty);
    await game.goTo('expedicao'); // o cliente da encomenda é atendido no balcão da Expedição (RN-191)
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

  test('RN-104/RN-189: a caixa de encomenda não ocupa a estufa e reduz o decaimento a 1/4', async ({ game }) => {
    await game.startDay({ campaign: { patch: office } });
    await assemble(game, 'carne');
    const p = await fry(game, 6.5);
    await box(game, p.id);
    await game.advance(50);
    const q = await game.hook((pf) => {
      const r = pf.sim.state.tickets.find((t) => t.kind === 'encomenda')!.slots.find((x) => x.filled)!.filled as { item: string; id: number; quality: number; readyAt: number; bagged?: boolean; warmed?: boolean };
      return { r, now: pf.sim.state.tick / 60, warmed: pf.sim.state.ready.filter((x) => x.warmed).length };
    });
    expect(q.r.bagged).toBe(true);
    expect(q.warmed, 'a caixa não usa a estufa').toBe(0);
    const waited = q.now - q.r.readyAt;
    expect(currentQuality(q.r, q.now)).toBeCloseTo(q.r.quality - Math.max(0, waited - 20) * 0.25, 5);
  });
});
