import { FLIPPER_OMEGA_DOWN, FLIPPER_OMEGA_UP, FLIPPER_REST, FLIPPER_UP, STEP } from '../../src/games/pinball-paulista/game/constants';
import { expect, test } from './support/test';

const FRAME = 1 / 60;

/**
 * Um quadro de 1/60 s roda 8 subpassos de `STEP` (1/480 s), mas o acumulador é ponto flutuante: na
 * fronteira o quadro pode rodar 7 ou 9. A tolerância é de 1 subpasso, como o `expectSteps` do Pastel.
 */
function expectOneFrame(angle: number, expected: number, omega: number): void {
  expect(Math.abs(angle - expected), `ângulo ${angle}, esperado ${expected} ± 1 subpasso`).toBeLessThanOrEqual(omega * STEP + 1e-9);
}

test.describe('Pinball Paulista — flippers', () => {
  test('PP-RN-05 Z, ← e A sobem o esquerdo; /, → e D o direito; sobem a FLIPPER_OMEGA_UP e descem a FLIPPER_OMEGA_DOWN', async ({ game }) => {
    await game.open();
    const keys: [string, number][] = [
      ['z', 0],
      ['ArrowLeft', 0],
      ['a', 0],
      ['/', 1],
      ['ArrowRight', 1],
      ['d', 1],
    ];
    for (const [key, i] of keys) {
      await game.keyDown(key, 1);
      let s = await game.state();
      // 1 quadro subindo: 8 subpassos (±1) a FLIPPER_OMEGA_UP
      expectOneFrame(s.flippers[i].angle, FLIPPER_REST - FLIPPER_OMEGA_UP * FRAME, FLIPPER_OMEGA_UP);
      expect(s.flippers[i].up).toBe(true);
      expect(s.flippers[1 - i].angle).toBe(FLIPPER_REST);
      await game.ev.quiet(() => game.frames(10));
      expect((await game.state()).flippers[i].angle).toBe(FLIPPER_UP);
      await game.keyUp(key, 1);
      s = await game.state();
      expectOneFrame(s.flippers[i].angle, FLIPPER_UP + FLIPPER_OMEGA_DOWN * FRAME, FLIPPER_OMEGA_DOWN);
      await game.ev.quiet(() => game.frames(20));
      expect((await game.state()).flippers[i].angle).toBe(FLIPPER_REST);
    }
  });

  test('PP-RN-05 o flipper batendo devolve a bola para cima', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 0 }); // pré-condição: sem segura-bola (a bola não pode voltar à rampa)
    // pré-condição: bola caindo sobre a ponta do flipper esquerdo
    await game.placeBall(88, 340, 0, 60);
    await game.ev.quiet(() => game.frames(3));
    await game.flipper('esquerdo', 6);
    const s = await game.state();
    expect(s.balls[0].vy, 'bola sobe depois da batida').toBeLessThan(-200);
    expect(s.phase).toBe('play');
  });

  test('PP-RN-05 PP-RN-04 mouse segurando a metade esquerda/direita da mesa move o flipper do lado', async ({ game }) => {
    await game.open();
    await game.touchFlipper('esquerdo', 0.2);
    let s = await game.state();
    // soltou há 0 quadros: ainda no alto; o outro não mexeu
    expect(s.flippers[0].angle).toBeLessThan(FLIPPER_REST);
    expect(s.flippers[1].angle).toBe(FLIPPER_REST);
    await game.ev.quiet(() => game.frames(20));
    await game.touchFlipper('direito', 0.2);
    s = await game.state();
    expect(s.flippers[1].angle).toBeLessThan(FLIPPER_REST);
    expect(s.flippers[0].angle).toBe(FLIPPER_REST);
  });
});
