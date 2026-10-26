import { expect, test } from './support/test';

test.describe('Fuga da Rocam — celular (390 px)', () => {
  test('FR-RN-32 FR-RN-08 sem rolagem lateral, HUD visível, direcional, deslize, TURBO e ÓLEO pelo toque', async ({ game, page }) => {
    await game.open();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await game.chooseMap('centro');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'partida sem rolagem lateral').toBe(true);
    await expect(game.canvas).toBeVisible();
    const box = (await game.canvas.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
    expect(box.width).toBeGreaterThan(330);
    await expect(page.locator('.fuga-rocam .hud-score')).toBeVisible();
    await expect(page.locator('.fuga-rocam .hearts')).toBeVisible();
    await expect(page.locator('.fuga-rocam .touch-controls')).toBeVisible();
    await expect(page.locator('.fuga-rocam .keys-help')).toBeHidden();

    // direcional
    await game.dpad(2);
    let s = await game.state();
    expect(s.want).toBe(2);
    expect(s.phase).toBe('play');
    // deslize no mapa: eixo dominante
    await game.swipe(1);
    expect((await game.state()).want).toBe(1);
    await game.swipe(0, 30);
    expect((await game.state()).want).toBe(0);
    // TURBO enquanto o dedo está no botão
    const t0 = (await game.state()).turbo;
    await game.holdTouch('TURBO', 30);
    s = await game.state();
    expect(s.turboOn).toBe(false);
    expect(s.turbo).toBeLessThan(t0);
    // ÓLEO a cada toque
    await game.tapButton('ÓLEO');
    s = await game.state();
    expect(s.oil).toBe(0);
    expect(s.puddles).toHaveLength(1);
  });
});
