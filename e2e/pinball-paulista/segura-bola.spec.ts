import { BONUS_SECONDS, SAVER_SECONDS } from '../../src/games/pinball-paulista/game/constants';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — segura-bola', () => {
  test('PP-RN-21 nos SAVER_SECONDS a bola que cai volta à rampa sem perder a bola; depois dele a bola é perdida', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    let s = await game.state();
    expect(s.saver).toBeGreaterThan(SAVER_SECONDS - 2);
    await expect(page.locator('.pinball-paulista .chip', { hasText: 'Segura-bola' })).toBeVisible();
    await game.drainBall(); // pré-condição: bola no ralo
    await game.advanceUntil((h) => h.state().balls[0]?.rest === true, 2, undefined, 1);
    s = await game.state();
    expect(s.phase).toBe('play');
    expect(s.ball).toBe(1);
    expect(s.message).toBe('SEGURA BOLA!');
    expect(s.bonusLog).toHaveLength(0);
    const frozen = s.saver;
    await game.ev.quiet(() => game.frames(60));
    expect((await game.state()).saver, 'parado com a bola na rampa').toBe(frozen);

    // joga até o segura-bola acabar (relançando se a bola voltar à rampa)
    for (let i = 0; i < 40; i++) {
      s = await game.state();
      if (s.saver <= 0) break;
      if (s.balls[0]?.rest) await game.launch(1);
      else await game.ev.quiet(() => game.frames(30));
    }
    s = await game.state();
    expect(s.saver).toBe(0);
    await expect(page.locator('.pinball-paulista .chip', { hasText: 'Segura-bola' })).toHaveCount(0);
    if (s.phase === 'play' && !s.balls[0].rest) {
      await game.drainBall(); // pré-condição: bola no ralo
      await game.waitPhase('bonus', 2);
    } else {
      await game.waitPhase('bonus', 30);
    }
    expect((await game.state()).ball).toBe(1);
    await game.ev.quiet(() => game.frames(Math.ceil(BONUS_SECONDS * 60) + 1));
    expect((await game.state()).ball).toBe(2);
  });
});
