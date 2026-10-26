import { BALL_R, MAX_DT, W } from '../../src/games/pinball-paulista/game/constants';
import { expectStored, readStorage } from '../support/storage';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — bordas', () => {
  test('PP-RN-03 PP-RN-30 quadro gigante é cortado em MAX_DT e a bola não atravessa a parede; abaixo de DRAIN_Y a bola é perdida', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida
    // pré-condição: bola rápida indo para a parede esquerda (x = 8)
    await game.placeBall(30, 262, -800, 0);
    const t0 = (await game.state()).time;
    await game.jump(5000);
    await game.ev.quiet(() => game.frames(1));
    await game.evidence('quadro de 5 s depois do salto');
    const s = await game.state();
    expect(s.time - t0).toBeCloseTo(MAX_DT, 9);
    expect(s.balls[0].x, 'dentro da parede esquerda').toBeGreaterThanOrEqual(8 + BALL_R - 1e-6);
    expect(s.balls[0].x).toBeLessThanOrEqual(W);
    expect(s.balls[0].vx, 'rebateu').toBeGreaterThan(0);
    await game.lights({ saver: 0 }); // pré-condição: sem segura-bola
    await game.drainBall(); // pré-condição: bola no ralo
    await game.waitPhase('bonus', 2);
  });

  test('PP-RN-30 PP-RN-25 com o armazenamento bloqueado o jogo abre, joga e sai sem erro', async ({ game, page }) => {
    await game.open({ blockStorage: true });
    await game.launchIntoPlay();
    const b = (await game.targets()).bumpers[0];
    await game.placeBall(b.x, b.y - 31, 0, 150); // pré-condição: bola caindo no bumper
    await game.advanceUntil((h) => h.state().score > 0, 1, undefined, 1);
    const root = page.locator('.pinball-paulista');
    await root.getByRole('button', { name: 'Som: sim' }).click();
    await expect(root.getByRole('button', { name: 'Som: não' })).toBeVisible();
    await root.getByRole('button', { name: '← Menu' }).click();
    await expect(root.getByRole('heading', { name: 'PINBALL PAULISTA' })).toBeVisible();
    await expect(root.locator('.record')).toHaveCount(0);
  });

  test('PP-RN-30 PP-RN-25 PP-RN-28 recorde e som corrompidos são ignorados', async ({ game, page }) => {
    await game.boot({ rawStorage: { 'pinball-paulista:recorde': 'abc', 'pinball-paulista:som': '{x' } });
    const root = page.locator('.pinball-paulista');
    await expect(root.locator('.record')).toHaveCount(0);
    await root.getByRole('button', { name: 'Jogar' }).click();
    await game.waitHook();
    expect((await game.state()).record).toBe(0);
    await expect(root.locator('.rec')).toHaveText('0');
    await expect(root.getByRole('button', { name: 'Som: sim' })).toBeVisible();
    expect(await readStorage(page, 'pinball-paulista:recorde')).toBe('abc');
  });

  test('PP-RN-30 montagem dupla (StrictMode) deixa um laço só; sair pela barra do hub no meio e voltar recomeça', async ({ game, page }) => {
    await game.open({ storage: { 'pinball-paulista:recorde': '10' } });
    await game.ev.quiet(() => game.frames(2));
    expect(await game.rafPending(), 'um laço de quadros').toBe(1);
    await game.launchIntoPlay();
    const b = (await game.targets()).bumpers[0];
    await game.placeBall(b.x, b.y - 31, 0, 150); // pré-condição: bola caindo no bumper
    await game.advanceUntil((h) => h.state().score > 10, 1, undefined, 1);
    const score = (await game.state()).score;
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
    await game.ev.quiet(() => game.frames(2));
    expect(await game.rafPending(), 'nenhum laço depois de sair').toBe(0);
    expect(await game.hasHook()).toBe(false);
    // o recorde novo foi salvo ao sair e aparece no card
    await expectStored(page, 'pinball-paulista:recorde', String(score));
    await expect(page.locator('.hub-card').filter({ has: page.locator('a[href="#/jogos/pinball-paulista"]') }).locator('.hub-record')).toHaveText(`Recorde ${score}`);
    await page.locator('.hub-card a[href="#/jogos/pinball-paulista"]').click();
    await page.locator('.pinball-paulista').getByRole('button', { name: 'Jogar' }).click();
    await game.waitHook();
    await game.ev.quiet(() => game.frames(2));
    const s = await game.state();
    expect(s).toMatchObject({ phase: 'ready', ball: 1, score: 0, record: score });
    expect(await game.rafPending()).toBe(1);
  });
});
