import { expect, test } from './support/test';

const noHScroll = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Capacete Voador — celular (390 px)', () => {
  test('CV-RN-35 390 px: menu e partida sem rolagem lateral, painéis abaixo do campo, mira por toque', async ({ game, page }) => {
    await game.open();
    expect(await noHScroll(page), 'menu sem rolagem lateral').toBe(true);
    await page.locator('.capacete-voador .card', { hasText: 'Treino' }).tap();
    await game.startButton.tap();
    await game.waitHook();
    await game.frames(1);
    expect(await noHScroll(page), 'partida sem rolagem lateral').toBe(true);

    const canvas = (await game.canvas.boundingBox())!;
    const board = (await page.locator('.capacete-voador .scoreboard').boundingBox())!;
    const panel = (await game.panel(0).boundingBox())!;
    expect(board.y + board.height, 'placar acima do campo').toBeLessThanOrEqual(canvas.y + 1);
    expect(panel.y, 'painel abaixo do campo').toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
    expect(canvas.width).toBeLessThanOrEqual(390);
    await expect(page.locator('.capacete-voador .scoreboard .wind')).toBeVisible();
    await expect(game.panel(0).locator('.moto-hp')).toBeVisible();

    // campos e botão em tamanho de toque
    const inputBox = (await game.angleInput(0).boundingBox())!;
    const btnBox = (await game.fireButton(0).boundingBox())!;
    expect(inputBox.height).toBeGreaterThanOrEqual(36);
    expect(btnBox.height).toBeGreaterThanOrEqual(40);

    await game.angleInput(0).tap();
    await expect(game.angleInput(0)).toBeFocused();
    await game.angleInput(0).fill('60');
    await game.velocityInput(0).tap();
    await game.velocityInput(0).fill('70');
    // o botão fica logo abaixo dos campos (o teclado virtual cobre a parte de baixo da tela, não o formulário)
    const v = (await game.velocityInput(0).boundingBox())!;
    const b = (await game.fireButton(0).boundingBox())!;
    expect(b.y - (v.y + v.height), 'botão colado aos campos').toBeLessThan(40);
    await game.fireButton(0).tap();
    await game.frames(1);
    const s = await game.state();
    expect(s.phase).toBe('flying');
    expect(s.lastShots[0]).toEqual({ angle: 60, velocity: 70 });
    await game.waitShot();
  });
});
