import { GRAVITY, PLUNGER_CHARGE_TIME, PLUNGER_MIN, PLUNGER_RANGE } from '../../src/games/pinball-paulista/game/constants';
import { expectStored } from '../support/storage';
import { expect, test } from './support/test';

const FRAME = 1 / 60;

test.describe('Pinball Paulista — pausa, foco e som', () => {
  test('PP-RN-26 P, Esc e o botão pausam; nada anda na pausa; Continuar e Menu', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    const dialog = page.getByRole('dialog', { name: 'Pausa' });
    for (const how of ['p', 'Escape', 'botão'] as const) {
      if (how === 'botão') await page.locator('.pinball-paulista .bar-actions').getByRole('button', { name: 'Pausar' }).click();
      else await game.pressKey(how);
      await expect(dialog).toBeVisible();
      const a = await game.state();
      expect(a.phase).toBe('paused');
      await game.keyDown('z', 60);
      await game.keyUp('z');
      const b = await game.state();
      expect(b.balls).toEqual(a.balls);
      expect(b.saver).toBe(a.saver);
      expect(b.time).toBe(a.time);
      expect(b.flippers).toEqual(a.flippers);
      if (how === 'p') await game.pressKey('p');
      else if (how === 'Escape') await game.pressKey('Escape');
      else await dialog.getByRole('button', { name: 'Continuar' }).click();
      await expect(dialog).toHaveCount(0);
      await game.ev.quiet(() => game.frames(1));
      expect((await game.state()).phase).toBe('play');
    }
    await game.pressKey('p');
    await dialog.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.pinball-paulista').getByRole('heading', { name: 'PINBALL PAULISTA' })).toBeVisible();
  });

  test('PP-RN-27 perder o foco pausa e solta os controles; a carga feita antes dispara ao continuar', async ({ game, page }) => {
    await game.open();
    await game.keyDown('Space', 20);
    await game.ev.quiet(() => page.evaluate(() => window.dispatchEvent(new Event('blur'))));
    await game.evidence('janela perdeu o foco');
    let s = await game.state();
    expect(s.phase).toBe('paused');
    await page.keyboard.up('Space');
    await page.getByRole('dialog', { name: 'Pausa' }).getByRole('button', { name: 'Continuar' }).click();
    await game.ev.quiet(() => game.frames(1));
    s = await game.state();
    const charge = (20 * FRAME) / PLUNGER_CHARGE_TIME;
    expect(s.balls[0].vy).toBeCloseTo(-(PLUNGER_MIN + PLUNGER_RANGE * charge) + GRAVITY * FRAME, 6);
    expect(s.phase).toBe('play');
  });

  test('PP-RN-28 Som: sim/não liga e desliga e a escolha fica salva', async ({ game, page }) => {
    await game.open();
    const bar = page.locator('.pinball-paulista .bar-actions');
    await expect(bar.getByRole('button', { name: 'Som: não' })).toBeVisible();
    await bar.getByRole('button', { name: 'Som: não' }).click();
    await expect(bar.getByRole('button', { name: 'Som: sim' })).toBeVisible();
    await expectStored(page, 'pinball-paulista:som', 'on');
    await page.reload();
    await page.getByRole('button', { name: 'Jogar' }).click();
    await expect(bar.getByRole('button', { name: 'Som: sim' })).toBeVisible();
    await bar.getByRole('button', { name: 'Som: sim' }).click();
    await expectStored(page, 'pinball-paulista:som', 'off');
  });
});
