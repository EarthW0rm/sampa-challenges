import { BLUE_LANE, CORRIDORS, GRAU_CHARGE_BLUE, GRAU_CHARGE_CORRIDOR, GRAU_DRAIN, GRAU_SPEED, GRAU_START, GRAU_STEER, LANES } from '../../src/games/corredor-sp/game/constants';
import { MODELS } from '../../src/games/corredor-sp/game/data';
import { FPS } from '../support/game-page';
import { steerDx } from './support/physics';
import { expect, test } from './support/test';

const entregadora = MODELS.find((m) => m.id === 'entregadora')!;

test.describe('Corredor SP — corredores, faixa azul e grau', () => {
  test('CS-RN-10 CS-RN-11 passar entre dois carros no corredor carrega 8%, na faixa azul 14%, na faixa não carrega', async ({ game }) => {
    // pré-condição: pista vazia; o teste põe pares de carros lentos lado a lado
    await game.race({ track: 'radial-leste' }, { calm: true });
    expect((await game.state()).player.grau).toBeCloseTo(GRAU_START, 5);
    let s = await game.drive({ frames: 120, x: CORRIDORS[1] });
    await game.prepare((h) => {
      h.prepare.spawn('carro', { lane: 1 }, 3000, 20);
      h.prepare.spawn('carro', { lane: 2 }, 3000, 20);
    });
    s = await game.drive({ frames: 600, x: CORRIDORS[1], until: (st) => st.overtakes >= 2 });
    expect(s.player.lives, 'cabe no corredor').toBe(3);
    expect(s.overtakes).toBe(2);
    expect(s.player.grau).toBeCloseTo(GRAU_START + 2 * GRAU_CHARGE_CORRIDOR, 5);

    // deixa os carros ultrapassados para trás antes de cruzar a faixa deles
    await game.drive({ frames: 90, x: CORRIDORS[1] });
    await game.steerTo(BLUE_LANE, { accelerate: true });
    await game.prepare((h) => {
      h.prepare.spawn('carro', { lane: 0 }, 3000, 20);
      h.prepare.spawn('carro', { lane: 1 }, 3000, 20);
    });
    s = await game.drive({ frames: 600, x: BLUE_LANE, until: (st) => st.overtakes >= 4 });
    expect(s.player.lives, 'a faixa azul é mais larga').toBe(3);
    expect(s.player.grau).toBeCloseTo(GRAU_START + 2 * GRAU_CHARGE_CORRIDOR + 2 * GRAU_CHARGE_BLUE, 5);

    await game.drive({ frames: 90, x: BLUE_LANE });
    await game.steerTo(LANES[3], { accelerate: true });
    await game.prepare((h) => h.prepare.spawn('carro', { lane: 2 }, 3000, 20));
    const before = (await game.state()).player.grau;
    s = await game.drive({ frames: 600, x: LANES[3], until: (st) => st.overtakes >= 5 });
    expect(s.overtakes).toBe(5);
    expect(s.player.grau, 'fora do corredor a ultrapassagem não carrega').toBeCloseTo(before, 5);
  });

  test('CS-RN-12 grau: precisa de 30% da velocidade, +20% de teto, direção pela metade, gasta 22%/s e desliga vazio', async ({ game }) => {
    // pré-condição: pista vazia
    await game.race({ track: 'radial-leste' }, { calm: true });
    await game.grau(30, false);
    let s = await game.state();
    expect(s.player.grauOn, 'parado não empina').toBe(false);
    expect(s.player.grau).toBeCloseTo(GRAU_START, 5);
    s = await game.drive({ frames: 600, x: LANES[2] });
    expect(s.player.kmh).toBeCloseTo(entregadora.vmax, 2);
    s = await game.drive({ frames: FPS, x: LANES[2], keys: ['ArrowUp', 'Space'], chunk: 6 });
    expect(s.player.grauOn).toBe(true);
    expect(s.player.grau).toBeCloseTo(GRAU_START - GRAU_DRAIN, 2);
    expect(s.player.kmh, 'teto sobe com o grau').toBeGreaterThan(entregadora.vmax);
    expect(s.player.kmh).toBeLessThanOrEqual(entregadora.vmax * GRAU_SPEED);
    // direção pela metade
    const x0 = s.player.x;
    await game.holdKeys(['ArrowUp', 'Space', 'ArrowLeft'], 12);
    s = await game.state();
    expect(Math.abs(s.player.x - x0)).toBeCloseTo(steerDx(entregadora.steer * GRAU_STEER, 0, 12), 1);
    s = await game.drive({ frames: 2 * FPS, keys: ['ArrowUp', 'Space'], until: (st) => st.player.grau === 0 });
    expect(s.player.grau).toBe(0);
    await game.frames(0);
    s = await game.drive({ frames: 6, keys: ['ArrowUp', 'Space'] });
    expect(s.player.grauOn, 'barra vazia desliga o grau mesmo segurando').toBe(false);
  });
});
