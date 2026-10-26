import { GRAU_START } from '../../src/games/corredor-sp/game/constants';
import { COUNTDOWN_FRAMES } from './support/page';
import { expect, test } from './support/test';

const noSideScroll = () => document.documentElement.scrollWidth <= window.innerWidth;

test.describe('Corredor SP — celular (390 px)', () => {
  test('CS-RN-07 ponteiro grosso: acelera sozinha, botões de toque abaixo da pista e HUD inteiro na tela', async ({ game, page }) => {
    await game.open();
    expect(await page.evaluate(noSideScroll), 'escolha sem rolagem lateral').toBe(true);
    await game.start();
    // pré-condição: pista vazia; os comandos são só pelos botões de toque
    await game.prepare((h) => h.prepare.calm(true));
    let s = await game.state();
    expect(s.input.autoAccel, 'ponteiro grosso liga a aceleração automática').toBe(true);
    await game.frames(COUNTDOWN_FRAMES + 120);
    s = await game.state();
    expect(s.player.kmh, 'acelerou sem tecla nenhuma').toBeGreaterThan(30);
    expect(await page.evaluate(noSideScroll), 'corrida sem rolagem lateral').toBe(true);
    const vw = page.viewportSize()!.width;
    const canvas = (await game.canvas.boundingBox())!;
    expect(canvas.x).toBeGreaterThanOrEqual(0);
    expect(canvas.x + canvas.width, 'HUD (canvas) inteiro na largura').toBeLessThanOrEqual(vw + 0.5);
    for (const name of ['left', 'right', 'brake', 'grau', 'helmet'] as const) {
      const btn = game.touchButton(name);
      await expect(btn).toBeVisible();
      const r = (await btn.boundingBox())!;
      expect(r.y, `${name} abaixo da pista`).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
      expect(r.x + r.width).toBeLessThanOrEqual(vw + 0.5);
    }

    const x0 = s.player.x;
    await game.touchBtn('left', 20);
    s = await game.state();
    expect(s.player.x).toBeLessThan(x0 - 0.1);
    await game.touchBtn('right', 40);
    const s2 = await game.state();
    expect(s2.player.x).toBeGreaterThan(s.player.x + 0.1);
    expect(s2.input.left || s2.input.right, 'soltar o dedo solta o comando').toBe(false);

    await game.frames(240);
    const fast = (await game.state()).player.kmh;
    await game.touchBtn('brake', 30);
    expect((await game.state()).player.kmh, 'FREIO').toBeLessThan(fast - 20);

    await game.frames(240);
    await game.touchBtn('grau', 20);
    s = await game.state();
    expect(s.player.grau, 'GRAU gastou a barra').toBeLessThan(GRAU_START - 0.05);

    // pré-condição: um capacete na linha da moto para o botão CAPACETE ter o que arremessar
    await game.prepare((h) => h.prepare.thing('capacete', h.state().player.x, 2500));
    await game.advanceUntil((h) => h.state().player.helmets === 1, 5);
    await game.touchBtn('helmet', 2);
    s = await game.state();
    expect(s.player.helmets).toBe(0);
    expect(s.helmetsFlying).toHaveLength(1);
  });
});
