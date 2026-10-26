import { expect, test } from './support/test';

test.describe('Fuga da Rocam — pausa', () => {
  test('FR-RN-27 P, Esc, botão e perda de foco pausam; nada anda; Continuar volta à fase anterior; Mapas sai', async ({ game, page }) => {
    await game.start('centro');
    // pausa no PRONTO e volta ao PRONTO
    await game.pressKey('KeyP');
    expect((await game.state()).phase).toBe('paused');
    await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
    await game.pressKey('Escape');
    expect((await game.state()).phase).toBe('ready');

    await game.turn('ArrowLeft');
    await game.frames(10);
    await page.getByRole('button', { name: 'Pausar' }).click();
    const p = await game.state();
    expect(p.phase).toBe('paused');
    expect(p.want, 'a direção guardada é esquecida').toBeNull();
    await game.frames(120);
    const q = await game.state();
    expect(q.player).toEqual(p.player);
    expect(q.time).toBe(p.time);
    await page.getByRole('dialog', { name: 'Pausa' }).getByRole('button', { name: 'Continuar' }).click();
    await game.frames(10);
    const r = await game.state();
    expect(r.phase).toBe('play');
    expect(r.player.dir, 'segue na direção em que estava').toBe(p.player.dir);
    expect(r.player.x).toBeLessThan(p.player.x);

    // perder o foco da janela pausa
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect((await game.state()).phase).toBe('paused');
    await game.pressKey('KeyP');
    expect((await game.state()).phase).toBe('play');

    // Mapas na caixa de pausa volta ao título
    await game.pressKey('Escape');
    await page.getByRole('dialog', { name: 'Pausa' }).getByRole('button', { name: 'Mapas' }).click();
    await expect(page.getByRole('heading', { name: 'FUGA DA ROCAM' })).toBeVisible();
  });
});
