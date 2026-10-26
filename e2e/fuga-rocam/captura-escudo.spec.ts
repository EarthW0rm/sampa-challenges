import { CATCH_HEAT_KEEP, CAUGHT_PAUSE, INVULN_TIME, SHIELD_INVULN, SHIELD_STUN, START_LIVES } from '../../src/games/fuga-rocam/game/constants';
import { mapById } from '../../src/games/fuga-rocam/game/maps';
import { expect, test } from './support/test';

const start = mapById('centro').start;

test.describe('Fuga da Rocam — captura, vidas e capacete', () => {
  test('FR-RN-23 pego: perde vida, PEGO!, volta ao começo com calor pela metade e invulnerável', async ({ game, page }) => {
    await game.start('centro');
    // a moto vai para a direita até parar na parede
    await game.turn('ArrowRight');
    await game.frames(90);
    // pré-condição rara: calor de 2 estrelas e um carro já na mesma rua, atrás da moto
    await game.hook((h) => h.prepare.heat(30));
    const s0 = await game.state();
    await game.hook((h, x) => h.prepare.cop('car', x - 3, 14, 0), s0.player.tx);
    await game.advanceUntil((h) => h.state().phase === 'caught', 5, undefined, 1);
    const c = await game.state();
    expect(c.lives).toBe(START_LIVES - 1);
    await expect(page.locator('.fuga-rocam .hearts')).toHaveAttribute('aria-label', `${START_LIVES - 1} vidas`);
    await game.frames(Math.floor(CAUGHT_PAUSE * 60) - 1);
    expect((await game.state()).phase, 'PEGO! dura CAUGHT_PAUSE').toBe('caught');
    await game.frames(2);
    const r = await game.state();
    expect(r.phase).toBe('ready');
    expect([r.player.tx, r.player.ty]).toEqual([start.tx, start.ty]);
    expect(r.copList).toHaveLength(0);
    expect(r.puddles).toHaveLength(0);
    expect(r.lastSeen).toBeNull();
    expect(r.heat).toBeCloseTo(c.heat * CATCH_HEAT_KEEP, 6);
    expect(r.stars).toBe(1 + Math.min(4, Math.floor(r.heat / 20)));
    expect(r.invuln).toBe(INVULN_TIME);
    expect(r.job).toEqual(c.job);
    expect(r.score).toBe(c.score);
    expect(r.message).toBe('Foge!');

    // invulnerável: um carro em cima da moto não prende
    await game.turn('ArrowLeft');
    await game.hook((h, t) => h.prepare.cop('car', t[0], t[1], 2), [start.tx, start.ty]);
    await game.frames(60);
    expect((await game.state()).phase).toBe('play');
    expect((await game.state()).lives).toBe(START_LIVES - 1);
  });

  test('FR-RN-24 capacete: a próxima captura vira escudo gasto, viatura parada e invulnerável', async ({ game, page }) => {
    await game.start('centro');
    await game.turn('ArrowLeft');
    await game.frames(6);
    // pré-condição rara: capacete no caminho da moto
    await game.hook((h) => h.prepare.item('capacete', 14, 14));
    await game.advanceUntil((h) => h.state().shield, 3, undefined, 2);
    expect((await game.state()).message).toBe('Capacete: escudo!');
    await expect(page.locator('.fuga-rocam .chips')).toContainText('escudo');
    // outro capacete não acumula
    await game.hook((h) => h.prepare.item('capacete', 10, 14));
    await game.advanceUntil((h) => h.state().itemList.length === 0, 3, undefined, 2);
    // pré-condição rara: carro em cima da moto
    const p = (await game.state()).player;
    await game.hook((h, t) => h.prepare.cop('car', t[0], t[1], 0), [p.tx, p.ty]);
    await game.frames(1);
    const s = await game.state();
    expect(s.phase).toBe('play');
    expect(s.lives).toBe(START_LIVES);
    expect(s.shield).toBe(false);
    expect(s.message).toBe('O capacete salvou!');
    expect(s.copList.at(-1)!.stun, 'a viatura que encostou').toBeCloseTo(SHIELD_STUN, 6);
    expect(s.invuln).toBeCloseTo(SHIELD_INVULN, 6);
  });
});
