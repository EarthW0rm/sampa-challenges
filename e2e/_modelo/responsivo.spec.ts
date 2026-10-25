import { expect, test } from './support/test';

test.describe('__TITULO__ — celular (390 px)', () => {
  test('sem rolagem lateral', async ({ game, page }) => {
    await game.open();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(game.canvas).toBeVisible();
  });
});
