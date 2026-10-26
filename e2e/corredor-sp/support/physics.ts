/** Contas do motor refeitas no teste (CS-RN-05, CS-RN-06), para comparar com o que a tela produziu. */
import { KMH } from '../../../src/games/corredor-sp/game/constants';
import type { MotoModel } from '../../../src/games/corredor-sp/game/data';
import { FPS } from '../../support/game-page';

/** Velocidade (km/h) depois de `n` quadros acelerando a partir de `v0`, com teto `top` (km/h). */
export function accelerateKmh(m: MotoModel, v0: number, n: number, top = m.vmax, accelFactor = 1): number {
  const vmax = top * KMH;
  const a = m.accel * accelFactor;
  let v = v0 * KMH;
  const dt = 1 / FPS;
  for (let i = 0; i < n; i++) {
    v += a * KMH * dt * Math.max(0.15, 1 - 0.6 * (v / vmax));
    if (v > vmax) v = Math.max(vmax, v - a * KMH * 2.5 * dt);
  }
  return v / KMH;
}

/** Deslocamento lateral depois de `n` quadros com a seta segurada, partindo de `vx0` (`grip` 9 seco, 3 na garoa). */
export function steerDx(maxLat: number, vx0: number, n: number, grip = 9): number {
  let vx = vx0;
  let x = 0;
  const dt = 1 / FPS;
  for (let i = 0; i < n; i++) {
    vx += (maxLat - vx) * Math.min(1, grip * dt);
    x += vx * dt;
  }
  return x;
}
