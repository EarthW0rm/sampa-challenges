import { ANIM_FRAMES } from './support/page';
import { expect, test } from './support/test';

test.describe('Xadrez Paulistano — celular (390 px)', () => {
  test('XP-RN-34 sem rolagem lateral, tabuleiro e botões visíveis, toque e arraste por toque jogam', async ({ game, page }) => {
    await game.open();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'menu sem rolagem lateral').toBe(true);
    await game.menu({ mode: 'pvp' });
    await game.play();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'partida sem rolagem lateral').toBe(true);
    const box = (await game.canvas.boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(box.width, 'tabuleiro ocupa a largura').toBeGreaterThan(vw * 0.85);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
    for (const b of ['← Menu', 'Girar', 'Desfazer', 'Desistir', 'Nova partida']) await expect(game.button(b)).toBeVisible();

    // toque: casa de origem e de destino
    for (const sq of ['e2', 'e4']) {
      const c = await game.square(sq);
      const p = await game.toClient(c.x, c.y);
      await game.ev.quiet(async () => {
        await page.touchscreen.tap(p.x, p.y);
        await game.frames(1);
      });
      await game.ev.action(`Toque na casa ${sq}`);
    }
    await game.frames(ANIM_FRAMES);
    expect((await game.state()).moves).toEqual(['e4']);

    // arraste por toque (eventos de toque do Chrome viram ponteiro "touch")
    const cdp = await page.context().newCDPSession(page);
    const a = await game.toClient(...Object.values(await game.square('g8')) as [number, number]);
    const b = await game.toClient(...Object.values(await game.square('f6')) as [number, number]);
    await game.ev.quiet(async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 }] });
        await game.frames(1);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await game.frames(2);
    });
    await game.ev.action('Arraste por toque g8 → f6');
    expect((await game.state()).moves).toEqual(['e4', 'Cf6']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
