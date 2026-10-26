import { DOG_SPEED } from '../../src/games/cachorro-loko/game/constants';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — celular (390 px)', () => {
  test('CL-RN-01 CL-RN-30 título e partida sem rolagem lateral; canvas e HUD cabem na largura', async ({ game, page }) => {
    const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await game.openTitle();
    await noHScroll();
    await game.start('click');
    await game.frames(FPS);
    await noHScroll();
    const box = (await game.canvas.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
    expect(box.height / box.width).toBeCloseTo(200 / 320, 2);
    for (const sel of ['.score', '.hud-right .record', '.lives']) {
      const el = page.locator(`.cachorro-loko ${sel}`);
      await expect(el).toBeVisible();
      const bb = (await el.boundingBox())!;
      expect(bb.x).toBeGreaterThanOrEqual(0);
      expect(bb.x + bb.width).toBeLessThanOrEqual(390);
    }
    for (const name of ['← Menu', 'Pausar']) {
      const bb = (await page.getByRole('button', { name }).boundingBox())!;
      expect(bb.x + bb.width).toBeLessThanOrEqual(390);
    }
  });

  test('CL-RN-04 toque segurando as metades do palco anda; as setas de toque aparecem', async ({ game, page }) => {
    await game.play();
    // pré-condição: chapeiro parado (só o movimento importa aqui)
    await game.chef(false);
    await expect(page.locator('.cachorro-loko .touch.left span')).toBeVisible();
    await expect(page.locator('.cachorro-loko .touch.right span')).toBeVisible();
    const x0 = (await game.state()).dog.x;
    await game.touch('right', FPS / 2);
    expect((await game.state()).dog.x - x0).toBeCloseTo(DOG_SPEED / 2, 6);
    await game.touch('left', FPS);
    const s = await game.state();
    expect(s.dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);
    expect(s.dog.facing).toBe(-1);
    await game.frames(20);
    expect((await game.state()).dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);
  });
});
