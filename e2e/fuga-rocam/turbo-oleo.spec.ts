import { OIL_STUN, OIL_TIME, PLAYER_SPEED, TURBO_DRAIN, TURBO_MIN_RESTART, TURBO_MULT, TURBO_RECHARGE } from '../../src/games/fuga-rocam/game/constants';
import { expect, test } from './support/test';

test.describe('Fuga da Rocam — turbo e óleo', () => {
  test('FR-RN-09 turbo acelera e gasta o tanque; zerado trava até recarregar o mínimo', async ({ game }) => {
    await game.start('centro');
    await game.turn('ArrowLeft');
    const a = await game.state();
    await game.turbo(60);
    const b = await game.state();
    expect(a.player.x - b.player.x, 'TURBO_MULT × PLAYER_SPEED em 1 s').toBeCloseTo(PLAYER_SPEED * TURBO_MULT, 4);
    expect(b.turbo).toBeCloseTo(1 - TURBO_DRAIN, 6);
    // Shift também liga; parado na parede o tanque continua gastando
    await game.turbo(Math.ceil(((1 - TURBO_DRAIN) / TURBO_DRAIN) * 60) + 2, 'ShiftLeft');
    const c = await game.state();
    expect(c.turboLocked, 'zerou: travado').toBe(true);
    expect(c.turbo).toBeLessThan(TURBO_MIN_RESTART);
    // travado, segurar Espaço não liga e o tanque recarrega
    await game.turbo(30);
    const d = await game.state();
    expect(d.turboOn).toBe(false);
    expect(d.turbo).toBeGreaterThan(c.turbo);
    await game.advanceUntil((h) => !h.state().turboLocked, 5, undefined, 1);
    const e = await game.state();
    expect(e.turbo).toBeGreaterThanOrEqual(TURBO_MIN_RESTART);
    expect(e.turbo - TURBO_RECHARGE / 60).toBeLessThan(TURBO_MIN_RESTART);
  });

  test('FR-RN-10 óleo: mancha atrás da moto derruba a viatura que passa; sem óleo, a tecla não faz nada', async ({ game }) => {
    await game.start('centro');
    await game.turn('ArrowLeft');
    await game.frames(20);
    await game.oil('KeyZ');
    const s = await game.state();
    expect(s.oil).toBe(0);
    expect(s.puddles).toHaveLength(1);
    expect(s.puddles[0].x, 'atrás da moto (andando para a esquerda)').toBeGreaterThan(s.player.x);
    expect(s.puddles[0].life).toBeCloseTo(OIL_TIME - 1 / 60, 6);
    await game.oil('KeyX');
    expect((await game.state()).puddles, 'sem óleo: nenhuma mancha nova').toHaveLength(1);
    // pré-condição rara: carro logo atrás, na mesma rua, para passar pela mancha
    await game.hook((h) => h.prepare.cop('car', 20, 14, 2));
    await game.advanceUntil((h) => h.state().copList.some((c) => c.stun > 0), 6, undefined, 1);
    const t = await game.state();
    expect(t.puddles, 'a mancha some ao derrubar').toHaveLength(0);
    expect(t.copList[0].stun).toBeCloseTo(OIL_STUN, 1);
    expect(t.phase).toBe('play');
    const x0 = t.copList[0].x;
    await game.frames(Math.floor(OIL_STUN * 60) - 2);
    expect((await game.state()).copList[0].x, 'parada enquanto derrapa').toBe(x0);
  });
});
