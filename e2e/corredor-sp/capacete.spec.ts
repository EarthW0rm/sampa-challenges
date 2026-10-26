import { MAX_HELMETS } from '../../src/games/corredor-sp/game/constants';
import { expect, test } from './support/test';

test.describe('Corredor SP — capacete', () => {
  test('CS-RN-13 guarda até 3; derruba carro, quica no ônibus, cone voa; sem capacete não arremessa', async ({ game }) => {
    // pré-condição: pista vazia; o teste põe 4 capacetes na linha da moto
    await game.race({ track: 'radial-leste' }, { calm: true });
    await game.prepare((h) => [1500, 2500, 3500, 4500].forEach((dz) => h.prepare.thing('capacete', 0, dz)));
    let s = await game.drive({ frames: 900, x: 0, until: (st) => st.items.length === 0 });
    expect(s.player.helmets, 'o 4º não muda nada').toBe(MAX_HELMETS);
    await game.brake(240);
    expect((await game.state()).player.speed).toBe(0);

    // pré-condição: carro e ônibus parados na linha da moto (o carro na frente)
    await game.prepare((h) => {
      const x = h.state().player.x;
      h.prepare.spawn('carro', { x }, 4000, 0);
      h.prepare.spawn('onibus', { x }, 7000, 0);
    });
    await game.helmet('x');
    await game.advanceUntil((h) => h.state().vehicles.some((v) => v.kind === 'carro' && v.state === 'spinout'), 2, undefined, 2);
    s = await game.state();
    expect(s.player.helmets).toBe(MAX_HELMETS - 1);
    expect(s.popups).toContain('CAPACETADA!');
    expect(s.vehicles.find((v) => v.kind === 'onibus')?.state, 'o 1º alvo leva').toBe('normal');
    await game.advanceUntil((h) => !h.state().vehicles.some((v) => v.kind === 'carro'), 3);

    await game.helmet('Enter');
    await game.advanceUntil((h) => h.state().popups.includes('TOC! GRANDE DEMAIS'), 3, undefined, 2);
    s = await game.state();
    expect(s.vehicles.find((v) => v.kind === 'onibus')?.state, 'grande demais: o capacete quica').toBe('normal');
    expect(s.player.helmets).toBe(MAX_HELMETS - 2);

    // pré-condição: sem o ônibus, um cone na linha
    await game.prepare((h) => {
      h.prepare.calm(true);
      h.prepare.thing('cone', h.state().player.x, 4000);
    });
    await game.helmet('x');
    await game.advanceUntil((h) => h.state().hazards.every((c) => c.hit), 2, undefined, 2);
    s = await game.state();
    expect(s.popups).toContain('CONE LONGE!');
    expect(s.player.helmets).toBe(0);
    await game.frames(120);
    await game.helmet('x');
    s = await game.state();
    expect(s.helmetsFlying, 'sem capacete, nada sai').toHaveLength(0);
    expect(s.player.helmets).toBe(0);
  });
});
