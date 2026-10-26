import { FLIPPER_REST } from '../../src/games/pinball-paulista/game/constants';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — celular (390 px)', () => {
  test('PP-RN-29 390 px: sem rolagem lateral, painéis laterais escondidos, faixa com o placar, mesa e botões visíveis', async ({ game, page }) => {
    await game.open();
    const root = page.locator('.pinball-paulista');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(root.locator('.side-left')).toBeHidden();
    await expect(root.locator('.side-right')).toBeHidden();
    await expect(root.locator('.strip')).toBeVisible();
    await expect(root.locator('.strip-score')).toHaveText('0');
    await expect(root.locator('.strip')).toContainText('×1');
    const box = (await game.canvas.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect(root.getByRole('button', { name: 'Lançar (segure e solte)' })).toBeVisible();
    await expect(root.getByRole('button', { name: 'Sacudir' })).toBeVisible();
    await expect(root.locator('.touch.left span')).toBeVisible();
  });

  test('PP-RN-29 PP-RN-05 PP-RN-06 PP-RN-07 toque: metades da mesa são os flippers, Lançar segurado lança, Sacudir dá o tranco', async ({ game, page }) => {
    await game.open();
    const t = await game.targets();
    for (const [side, rect, i] of [['esquerdo', t.flipperLeft, 0], ['direito', t.flipperRight, 1]] as const) {
      await game.touchHoldAt(rect.x + rect.w / 2, rect.y + rect.h * 0.75, 10);
      const s = await game.state();
      // soltou há 1 quadro: ainda acima do repouso, e o outro flipper não mexeu
      expect(s.flippers[i].angle, side).toBeLessThan(FLIPPER_REST - 0.3);
      expect(s.flippers[1 - i].angle).toBe(FLIPPER_REST);
      await game.ev.quiet(() => game.frames(20));
    }
    const btn = page.locator(t.launch);
    const box = (await btn.boundingBox())!;
    await game.touchHoldClient(box.x + box.width / 2, box.y + box.height / 2, 60, 'no botão Lançar');
    let s = await game.state();
    expect(s.phase).toBe('play');
    expect(s.balls[0].rest).toBe(false);
    await game.advanceUntil((h) => h.state().balls[0].x < 210, 3);
    const nb = (await page.locator(t.nudge).boundingBox())!;
    await game.touchHoldClient(nb.x + nb.width / 2, nb.y + nb.height / 2, 2, 'no botão Sacudir');
    s = await game.state();
    expect(s.nudges).toBeGreaterThan(0.9);
    await expect(page.locator('.pinball-paulista .strip-score')).toBeVisible();
  });
});
