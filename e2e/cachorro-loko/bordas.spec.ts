import { START_LIVES } from '../../src/games/cachorro-loko/game/constants';
import { FPS } from '../support/game-page';
import { HubPage } from '../support/hub';
import { readStorage } from '../support/storage';
import { RECORD_KEY } from './support/page';
import { expect, test } from './support/test';

/** Limite do quadro no laço do motor (CL-RN-29). */
const MAX_DT = 0.05;

test.describe('Cachorro Loko — bordas', () => {
  test('CL-RN-29 quadro gigante (aba que volta) avança só 0,05 s; com foco perdido segue pausado', async ({ game }) => {
    await game.play();
    await game.frames(FPS);
    let before = await game.state();
    await game.jump(60_000);
    await game.frames(1);
    let s = await game.state();
    expect(s.time - before.time).toBeCloseTo(MAX_DT, 9);
    expect(s.lives).toBe(START_LIVES);

    // aba em segundo plano: perde o foco (pausa) e volta muito depois
    await game.blurWindow();
    before = await game.state();
    await game.jump(120_000);
    await game.frames(FPS);
    s = await game.state();
    expect(s.phase).toBe('paused');
    expect(s.time).toBe(before.time);
  });

  test('CL-RN-27 armazenamento bloqueado: o jogo abre, joga até o fim e só não guarda recorde', async ({ game, page }) => {
    await game.play({ blockStorage: true });
    // pré-condições: chapeiro parado e 1 vida
    await game.chef(false);
    await game.setLives(1);
    await game.settle(await game.dropOnDog('normal'));
    await game.settle(await game.dropAt('normal', 10));
    await game.waitGameOver();
    await expect(page.getByRole('dialog', { name: 'Fim de jogo' }).locator('.final-score')).toHaveText('1 entregas');
    await page.getByRole('dialog', { name: 'Fim de jogo' }).getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByText(/^Recorde:/)).toHaveCount(0);
  });

  test('CL-RN-27 recorde corrompido conta como 0; fração é truncada', async ({ game, page }) => {
    await game.openTitle({ rawStorage: { [RECORD_KEY]: 'abc' } });
    await expect(page.getByText(/^Recorde:/)).toHaveCount(0);
    await game.start();
    expect((await game.state()).record).toBe(0);
    await expect(page.locator('.cachorro-loko .hud-right .record')).toHaveText('RECORDE 000');

    await page.evaluate((k) => localStorage.setItem(k, '12.7'), RECORD_KEY);
    await page.reload();
    await expect(page.getByText('Recorde: 12')).toBeVisible();
    await page.evaluate((k) => localStorage.setItem(k, '-5'), RECORD_KEY);
    await page.reload();
    await expect(page.getByText(/^Recorde:/)).toHaveCount(0);
    expect(await readStorage(page, RECORD_KEY)).toBe('-5');
  });

  test('CL-RN-24 CL-RN-28 StrictMode: um laço e um listener só; sair pelo hub no meio da partida e voltar começa do zero', async ({ game, page }) => {
    await game.play();
    await game.frames(FPS);
    expect(await game.rafPending(), 'um laço de quadros vivo').toBe(1);
    // listener de teclado duplicado alternaria a pausa duas vezes
    await game.pause('KeyP');
    expect((await game.state()).phase).toBe('paused');
    await game.pause('KeyP');
    expect((await game.state()).phase).toBe('playing');

    // pré-condição: placar 5 no meio da partida
    await game.setScore(5);
    const hub = new HubPage(page, game.ev);
    await hub.back();
    expect(await game.rafPending(), 'nenhum laço depois de sair').toBe(0);
    expect(await game.hasHook(), 'gancho limpo no cleanup').toBe(false);
    expect(await readStorage(page, RECORD_KEY), 'sair não salva recorde').toBeNull();

    await hub.openGame('cachorro-loko');
    await game.start();
    const s = await game.state();
    expect(s).toMatchObject({ phase: 'playing', score: 0, lives: START_LIVES });
    await game.frames(10);
    expect(await game.rafPending()).toBe(1);
  });
});
