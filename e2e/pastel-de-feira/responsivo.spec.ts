import { expect, test } from './support/game';
import { assemble, takeOrder } from './support/flow';

/** Checklist do repositório: ≈ 390 px de largura; RN-74 (toque mapeado para 640×480). */
test.describe('Celular (390 px)', () => {
  test('sem rolagem horizontal no título, no Preparo e no dia', async ({ game, page }) => {
    const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await game.boot();
    await noHScroll();
    await game.continueToPrep();
    await noHScroll();
    await game.openFair();
    await noHScroll();
    const box = await game.canvas.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
    expect(box!.height / box!.width).toBeCloseTo(480 / 640, 2);
  });

  test('o toque no canvas reduzido acerta as estações e o painel', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    await takeOrder(game);
    await assemble(game, 'carne');
    expect(await game.hook((pf) => pf.sim.state.assembled.length)).toBe(1);
  });

  test('o HUD cabe na largura e os botões continuam acessíveis', async ({ game, page }) => {
    await game.startDay();
    for (const name of ['Efeitos sonoros', 'Música', 'Acelerar', 'Pausar']) {
      const b = page.getByRole('button', { name });
      await expect(b).toBeVisible();
      const bb = await b.boundingBox();
      expect(bb!.x + bb!.width).toBeLessThanOrEqual(390);
    }
  });
});
