import { METERS_PER_POINT } from '../../src/games/corredor-sp/game/constants';
import type { CorredorSnapshot } from '../../src/games/corredor-sp/game/engine';
import { expect, test } from './support/test';

/** Pontos pela fórmula do manual (CS-RN-25), recalculados no teste. */
const formula = (s: CorredorSnapshot): number => (Math.floor(s.time) + Math.floor(s.meters / METERS_PER_POINT)) * (1 + s.packages);

test.describe('Corredor SP — pontuação', () => {
  test('CS-RN-25 pontos = (segundos + metros ÷ 10) × (1 + pacotes); mais rápido pontua mais', async ({ game }) => {
    // pré-condição: pista vazia (o teste põe os pacotes)
    await game.race({ track: 'radial-leste' }, { calm: true });
    let s = await game.drive({ frames: 600, x: 0 });
    expect(s.points).toBe(formula(s));
    expect(s.points).toBeGreaterThan(Math.floor(s.time));
    expect(s.meters).toBeGreaterThan(100);
    // pré-condição: dois pacotes na linha da moto
    await game.prepare((h) => {
      h.prepare.thing('pacote', h.state().player.x, 3000);
      h.prepare.thing('pacote', h.state().player.x, 6000);
    });
    s = await game.drive({ frames: 600, x: 0, until: (st) => st.items.length === 0 });
    expect(s.packages).toBe(2);
    await game.frames(30);
    s = await game.state();
    expect(s.points).toBe(formula(s));
    // parado, só o tempo conta: 2 s a mais = 2 × (1 + pacotes)
    await game.brake(240);
    const a = await game.state();
    expect(a.player.speed).toBe(0);
    await game.frames(120);
    const b = await game.state();
    expect(b.points - a.points).toBe((Math.floor(b.time) - Math.floor(a.time)) * (1 + b.packages));
  });
});
