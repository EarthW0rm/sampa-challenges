import { HEAD_X } from '../../src/games/sinuca-de-bar/game/constants';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — celular (390 px)', () => {
  test('SB-RN-36 390 px sem rolagem lateral; toque mira e arrasta a branca; HUD e controles visíveis', async ({ game, page }) => {
    const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await game.open();
    expect(await noScroll(), 'menu sem rolagem lateral').toBe(true);
    await page.locator('.sinuca-de-bar').getByRole('button', { name: 'Jogar' }).tap();
    await game.waitHook();
    await game.frames(1);
    expect(await noScroll(), 'partida sem rolagem lateral').toBe(true);
    const box = (await game.canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);
    for (const name of ['Tacar!', 'Nova partida', '← Menu']) await expect(page.getByRole('button', { name })).toBeInViewport({ ratio: 0.5 });
    await expect(game.powerBar).toBeVisible();
    await expect(page.getByText(/tem bola na mão/)).toBeVisible();

    const cue = (await game.state()).balls[0];
    await game.touchTap(cue.x, cue.y - 50);
    expect(((await game.state()).aim * 180) / Math.PI).toBeCloseTo(-90, 0);
    await game.touchDrag({ x: cue.x, y: cue.y }, { x: 50, y: 70 });
    const s = await game.state();
    expect(s.balls[0].x).toBeCloseTo(50, 0);
    expect(s.balls[0].y).toBeCloseTo(70, 0);
    expect(s.balls[0].x).toBeLessThanOrEqual(HEAD_X);
    await game.shootButton.tap();
    await game.frames(30);
    expect((await game.state()).phase).toBe('rolling');
  });
});
