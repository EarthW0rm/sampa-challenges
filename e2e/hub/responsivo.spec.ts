import { expect, HUB_GAMES, test } from './test';

const noSideScroll = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Hub — celular (390 px)', () => {
  test('HUB-RN-55 home sem rolagem lateral; toque no card abre o jogo', async ({ game, page }) => {
    await game.open();
    expect(await noSideScroll(page), 'home').toBe(true);
    await game.card('cachorro-loko').locator('a').tap();
    await game.waitGame('cachorro-loko');
  });

  for (const g of HUB_GAMES) {
    test(`HUB-RN-55 barra de volta sem rolagem lateral com ${g.id} aberto`, async ({ game, page }) => {
      await game.open();
      await game.openGame(g.id);
      const bar = await page.locator('.hub-bar').boundingBox();
      expect(bar!.x + bar!.width, 'barra cabe na largura').toBeLessThanOrEqual(390 + 0.5);
      await expect(page.getByRole('link', { name: '← Sampa Challenges' })).toBeInViewport();
      await game.back();
      expect(await noSideScroll(page), 'home depois de voltar').toBe(true);
    });
  }
});
