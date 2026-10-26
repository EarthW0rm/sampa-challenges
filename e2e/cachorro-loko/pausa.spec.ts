import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — pausa', () => {
  test('CL-RN-05 CL-RN-24 primeiro pedido em 1 s; P, Esc e o botão pausam e continuam; na pausa nada anda e as teclas são soltas', async ({ game, page }) => {
    await game.play();
    await game.advanceUntil((h) => h.events().some((e) => e.ev === 'spawn'), 2, undefined, 1);
    const first = (await game.events()).find((e) => e.ev === 'spawn')!;
    expect(first.t, 'primeiro pedido em 1 s').toBeCloseTo(1, 1);
    await game.frames(FPS);

    await game.pause('KeyP');
    const dialog = page.getByRole('dialog', { name: 'Pausa' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' }).first()).toBeVisible();
    const paused = await game.state();
    expect(paused.phase).toBe('paused');
    // segura → durante a pausa: nada anda
    await page.keyboard.down('ArrowRight');
    await game.frames(2 * FPS);
    let s = await game.state();
    expect(s.time).toBe(paused.time);
    expect(s.boxes).toEqual(paused.boxes);
    expect(s.dog.x).toBe(paused.dog.x);
    expect(s.spawnTimer).toBe(paused.spawnTimer);

    // continuar com Esc solta a tecla segura: o cachorro não sai andando sozinho
    await game.pause('Escape');
    await expect(dialog).toBeHidden();
    await game.frames(30);
    s = await game.state();
    expect(s.phase).toBe('playing');
    expect(s.time).toBeGreaterThan(paused.time);
    expect(s.dog.x).toBe(paused.dog.x);
    await page.keyboard.up('ArrowRight');

    // botão da barra pausa; Continuar do diálogo continua
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(dialog).toBeVisible();
    expect((await game.state()).phase).toBe('paused');
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialog).toBeHidden();
    expect((await game.state()).phase).toBe('playing');

    // Menu do diálogo de pausa volta ao título
    await game.pause('KeyP');
    await dialog.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('heading', { name: 'CACHORRO LOKO' })).toBeVisible();
  });

  test('CL-RN-25 a janela perder o foco pausa a partida, que continua pausada até o jogador continuar', async ({ game, page }) => {
    await game.play();
    await game.frames(FPS);
    await game.blurWindow();
    await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
    const t = (await game.state()).time;
    await game.frames(FPS);
    expect((await game.state()).time).toBe(t);
    await game.pause('KeyP');
    await game.frames(10);
    expect((await game.state()).phase).toBe('playing');
  });
});
