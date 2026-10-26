import { DAY_CYCLE, LANES } from '../../src/games/corredor-sp/game/constants';
import { MODELS } from '../../src/games/corredor-sp/game/data';
import { FPS } from '../support/game-page';
import { steerDx } from './support/physics';
import { expect, test } from './support/test';

const entregadora = MODELS.find((m) => m.id === 'entregadora')!;

test.describe('Corredor SP — garoa e dia/noite', () => {
  test('CS-RN-19 1ª garoa aos 70 s, dura 25–40 s; freio rende 25% menos e a direção responde mais devagar', async ({ game }) => {
    await game.race({ track: 'radial-leste' });
    await game.steerTo(1.2); // parada na terra, longe do trânsito
    const t = (await game.state()).time;
    await game.frames(Math.round((70 - t) * FPS) - 3);
    expect((await game.state()).rain.on).toBe(false);
    await game.frames(6);
    let s = await game.state();
    expect(s.rain.on, 'a 1ª garoa começa aos 70 s').toBe(true);
    expect(s.banner).toBe('GAROA: PISTA ESCORREGADIA');
    expect(s.rain.timer).toBeGreaterThanOrEqual(25 - 0.2);
    expect(s.rain.timer).toBeLessThanOrEqual(40);
    // pré-condição: pista vazia para medir freio e direção
    await game.prepare((h) => h.prepare.calm(true));
    s = await game.drive({ frames: 600, x: LANES[2] });
    expect(s.player.kmh).toBeCloseTo(entregadora.vmax, 2);
    await game.brake(30);
    expect((await game.state()).player.kmh, 'freio × 0,75').toBeCloseTo(entregadora.vmax - entregadora.brake * 0.75 * 0.5, 1);
    s = await game.drive({ frames: 300, x: LANES[2] });
    const x0 = s.player.x;
    await game.holdKeys(['ArrowUp', 'ArrowLeft'], 12);
    s = await game.state();
    expect(Math.abs(s.player.x - x0), 'aderência 3 em vez de 9').toBeCloseTo(steerDx(entregadora.steer, 0, 12, 3), 1);
    expect(Math.abs(s.player.x - x0)).toBeLessThan(steerDx(entregadora.steer, 0, 12, 9));
    s = await game.drive({ frames: 45 * FPS, x: LANES[2], until: (st) => !st.rain.on, chunk: 30 });
    expect(s.rain.on, 'a garoa passa').toBe(false);
    expect(s.rain.timer).toBeGreaterThanOrEqual(50 - 1);
    expect(s.rain.timer).toBeLessThanOrEqual(110);
  });

  test('CS-RN-18 ciclo de 4 min: claro até 15%, noite cheia de 35% a 70%, manhã até 85%', async ({ game }) => {
    // pré-condição: pista vazia (só o céu interessa)
    await game.race({ track: 'nacoes-unidas' }, { calm: true });
    const at = async (frac: number) => {
      await game.prepare((h, t) => h.prepare.time(t), frac * DAY_CYCLE); // pré-condição: hora do dia
      await game.frames(1);
      const s = await game.state();
      await game.evidence(`Ciclo do dia em ${Math.round(frac * 100)}%: escuridão ${s.night.toFixed(2)}`);
      return s.night;
    };
    expect(await at(0.1)).toBe(0);
    expect(await at(0.25)).toBeCloseTo(0.5, 2);
    expect(await at(0.5)).toBe(1);
    expect(await at(0.775)).toBeCloseTo(0.5, 2);
    expect(await at(0.9)).toBe(0);
    expect(await at(1.5)).toBe(1);
  });
});
