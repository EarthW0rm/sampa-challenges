import { CRASH_TIME, INVULNERABLE_TIME, LANES, START_LIVES } from '../../src/games/corredor-sp/game/constants';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Corredor SP — vidas, batida e colisão', () => {
  test('CS-RN-08 bater tira 1 vida, 2 s no chão sem pegar item, volta parada e fica 3 s invulnerável', async ({ game }) => {
    // pré-condição: pista vazia; o teste põe um carro parado na faixa 2
    await game.race({ track: 'radial-leste' }, { calm: true });
    await game.steerTo(LANES[1]);
    await game.prepare((h) => h.prepare.spawn('carro', { lane: 1 }, 2500, 0));
    let s = await game.drive({ frames: 600, x: LANES[1], until: (st) => st.player.crashT > 0 });
    expect(s.player.lives).toBe(START_LIVES - 1);
    expect(s.banner).toBe('BATEU!');
    const t0 = s.time;
    await game.frames(60);
    expect((await game.state()).player.speed, 'caída, a moto para').toBe(0);
    // pré-condição: pacote em cima da moto caída (já parada)
    await game.prepare((h) => h.prepare.thing('pacote', h.state().player.x, 0));
    await game.frames(Math.round(CRASH_TIME * FPS) - 90);
    s = await game.state();
    expect(s.player.crashT).toBeGreaterThan(0);
    expect(s.packages, 'caído não pega item').toBe(0);
    expect(s.time - t0, 'o cronômetro continua').toBeGreaterThan(1);
    await game.frames(40);
    s = await game.state();
    expect(s.player.crashT).toBeLessThanOrEqual(0);
    expect(s.player.speed, 'volta do zero').toBe(0);
    expect(s.player.invul).toBeGreaterThan(INVULNERABLE_TIME - 0.5);
    expect(Math.abs(s.player.x)).toBeLessThanOrEqual(0.9);
    expect(s.vehicles.filter((v) => Math.abs(v.dz) < 900), 'tirou da pista quem estava em cima').toHaveLength(0);
    // o pacote ficou parado sob a moto: invulnerável pega
    expect(s.packages).toBe(1);
    // pré-condição: carro em cima da moto invulnerável
    await game.prepare((h) => h.prepare.spawn('carro', { x: h.state().player.x }, 0, 0));
    await game.frames(30);
    expect((await game.state()).player.lives, 'invulnerável não bate').toBe(START_LIVES - 1);
    await game.frames(Math.round(INVULNERABLE_TIME * FPS));
    s = await game.state();
    expect(s.player.invul).toBeLessThanOrEqual(0);
    expect(s.player.lives, 'acabou a proteção: o carro parado em cima derruba').toBe(START_LIVES - 2);
  });

  test('CS-RN-09 moto por trás não bate; ambulância por trás e contramão batem', async ({ game }) => {
    // pré-condição: pista vazia; cada veículo é posto pelo teste já sobre a moto parada
    await game.race({ track: 'radial-leste' }, { calm: true });
    const x = (await game.state()).player.x;
    await game.prepare((h, px) => h.prepare.spawn('moto', { x: px }, -2500, 100), x);
    await game.advanceUntil((h) => h.state().vehicles.every((v) => v.dz > 1000), 3);
    expect((await game.state()).player.lives, 'moto que vem por trás desvia').toBe(START_LIVES);
    await game.prepare((h) => h.prepare.calm(true));
    await game.prepare((h, px) => h.prepare.spawn('ambulancia', { x: px }, -1500, 155), x);
    await game.advanceUntil((h) => h.state().player.crashT > 0, 3);
    expect((await game.state()).player.lives, 'ambulância bate').toBe(START_LIVES - 1);
    await game.frames(Math.round((CRASH_TIME + INVULNERABLE_TIME) * FPS) + 5);
    await game.prepare((h) => h.prepare.calm(true));
    const px = (await game.state()).player.x;
    await game.prepare((h, p) => h.prepare.spawn('contramao', { x: p }, 3000, 50), px);
    await game.advanceUntil((h) => h.state().player.crashT > 0, 5);
    expect((await game.state()).player.lives, 'contramão bate').toBe(START_LIVES - 2);
  });
});
