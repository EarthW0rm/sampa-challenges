import { BONUS_SECONDS, FLIPPER_REST, NUDGE_DECAY, NUDGE_LIMIT, NUDGE_PUSH_X, NUDGE_PUSH_Y, GRAVITY } from '../../src/games/pinball-paulista/game/constants';
import { expect, test } from './support/test';

const FRAME = 1 / 60;

test.describe('Pinball Paulista — sacudir e tilt', () => {
  test('PP-RN-07 tranco só em jogo, empurra a bola, respeita o intervalo e a conta cai NUDGE_DECAY por segundo', async ({ game }) => {
    await game.open();
    await game.nudge();
    expect((await game.state()).nudges, 'na rampa (fase ready) N não faz nada').toBe(0);
    await game.launchIntoPlay();
    // pré-condição: bola parada no meio da mesa, longe de tudo
    await game.placeBall(111, 262, 0, 0);
    await game.nudge();
    let s = await game.state();
    expect(Math.abs(s.balls[0].vx)).toBeCloseTo(NUDGE_PUSH_X, 6);
    expect(s.balls[0].vy).toBeCloseTo(-NUDGE_PUSH_Y + GRAVITY * FRAME, 6);
    expect(s.nudges).toBeCloseTo(1 - NUDGE_DECAY * FRAME, 9);
    // 2º tranco 1 quadro depois: dentro do NUDGE_COOLDOWN, ignorado
    await game.nudge();
    s = await game.state();
    expect(s.nudges).toBeCloseTo(1 - 2 * NUDGE_DECAY * FRAME, 9);
    await game.ev.quiet(() => game.frames(118));
    expect((await game.state()).nudges).toBeCloseTo(1 - 120 * NUDGE_DECAY * FRAME, 9);
  });

  test('PP-RN-08 PP-RN-07 CUIDADO no 3º tranco, TILT no 4º: flippers e raias param, bônus 0, sem segura-bola, bola extra perdida', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    // pré-condição: próximo prêmio do Minhocão = bola extra, e a bola no buraco
    await game.lights({ nextAward: 'extra', kickCd: 0 });
    await game.placeBall(111, 215, 0, 80);
    await game.advanceUntil((h) => h.state().extraPending, 3, undefined, 1);
    // pré-condição: base do bônus > 0 (bola sobre o bumper da esquerda)
    await game.placeBall(84, 115, 0, 150);
    await game.advanceUntil((h) => h.state().bumperHits[0] > 0, 1, undefined, 1);
    expect((await game.state()).bonusBase).toBeGreaterThan(0);
    for (let i = 1; i <= NUDGE_LIMIT + 1; i++) {
      // pré-condição: bola parada no alto da mesa (o tranco precisa de bola em jogo)
      await game.placeBall(111, 262, 0, 0);
      await game.nudge(12);
      const s = await game.state();
      if (i < NUDGE_LIMIT) expect(s.tilt).toBe(false);
      if (i === NUDGE_LIMIT) {
        expect(s.message).toBe('CUIDADO!');
        expect(s.tilt).toBe(false);
      }
      if (i === NUDGE_LIMIT + 1) {
        expect(s.tilt).toBe(true);
        expect(s.message).toBe('TILT!');
      }
    }
    await expect(page.locator('.pinball-paulista .chip', { hasText: 'Tilt' })).toBeVisible();
    // pré-condição: raia 1 acesa, para ver que o flipper não gira as luzes em tilt
    await game.lights({ rolls: [true, false, false] });
    await game.keyDown('z', 10);
    let s = await game.state();
    expect(s.flippers[0].angle).toBe(FLIPPER_REST);
    expect(s.rolls).toEqual([true, false, false]);
    await game.keyUp('z');
    expect(s.saver, 'segura-bola ainda ligado').toBeGreaterThan(0);
    await game.drainBall(); // pré-condição: bola no ralo
    await game.waitPhase('bonus', 2);
    s = await game.state();
    expect(s.bonus).toEqual({ base: 0, mult: 1, total: 0 });
    await expect(page.locator('.pinball-paulista .bonus-total')).toHaveText('TILT: sem bônus');
    await game.ev.quiet(() => game.frames(Math.ceil(BONUS_SECONDS * 60) + 1));
    s = await game.state();
    expect(s.phase).toBe('ready');
    expect(s.ball, 'bola extra perdida no tilt').toBe(2);
    expect(s.extraPending).toBe(false);
    expect(s.tilt).toBe(false);
  });
});
