import { LEVEL_TIME, SPAWN_AHEAD_MAX, TRAFFIC_MAX, TRAFFIC_RAMP, TRAFFIC_START } from '../../src/games/corredor-sp/game/constants';
import { VEHICLE_SPEED } from '../../src/games/corredor-sp/game/data';
import type { CorredorSnapshot } from '../../src/games/corredor-sp/game/engine';
import { expect, test } from './support/test';

/** Veículos que contam para a densidade (CS-RN-17). */
const around = (s: CorredorSnapshot) => s.vehicles.filter((v) => v.dz > -1500 && v.dz < SPAWN_AHEAD_MAX && v.kind !== 'ambulancia' && v.kind !== 'contramao').length;
const target = (t: number) => Math.round(TRAFFIC_START + (TRAFFIC_MAX - TRAFFIC_START) * Math.min(1, t / TRAFFIC_RAMP));

test.describe('Corredor SP — nível e densidade', () => {
  test('CS-RN-16 nível sobe a cada 45 s com faixa e nome; trânsito novo mais rápido', async ({ game }) => {
    // pré-condição: pista vazia (o teste põe os carros para medir a velocidade)
    await game.race({ track: 'radial-leste' }, { calm: true });
    expect((await game.state()).level).toBe(1);
    await game.prepare((h, t) => h.prepare.time(t), LEVEL_TIME - 0.1); // pré-condição: fim do nível 1
    await game.frames(10);
    let s = await game.state();
    expect(s.level).toBe(2);
    expect(s.banner).toBe('NÍVEL 2 · TRÂNSITO PESADO');
    await game.prepare((h, t) => h.prepare.time(t), 2 * LEVEL_TIME - 0.1);
    await game.frames(10);
    s = await game.state();
    expect(s.level).toBe(3);
    expect(s.banner).toBe('NÍVEL 3 · HORA DO RUSH');
    await game.prepare((h) => h.prepare.level(11)); // pré-condição: nível alto (fator de velocidade no teto)
    await game.frames(2);
    expect((await game.state()).level).toBe(11);
    await game.prepare((h) => {
      for (let i = 0; i < 4; i++) h.prepare.spawn('carro', { lane: i }, 20000 + i * 3000);
    });
    s = await game.state();
    const [a, b] = VEHICLE_SPEED.carro;
    const factor = Math.min(1.6, 1 + 0.06 * (11 - 1));
    for (const v of s.vehicles) {
      expect(v.kmh).toBeGreaterThanOrEqual(a * factor - 0.01);
      expect(v.kmh).toBeLessThanOrEqual(b * factor + 0.01);
      expect(v.kmh, 'no teto do fator, o mais lento já anda no máximo do nível 1').toBeGreaterThanOrEqual(b - 0.01);
    }
  });

  test('CS-RN-17 começa com 6 veículos à frente e enche em linha reta até 42 em 6 min', async ({ game }) => {
    await game.race({ track: '23-de-maio' });
    let s = await game.state();
    expect(around(s)).toBe(TRAFFIC_START);
    for (const t of [TRAFFIC_RAMP / 2, TRAFFIC_RAMP]) {
      await game.prepare((h, x) => h.prepare.time(x), t); // pré-condição: tempo de turno avançado
      await game.advanceUntil((h, n) => {
        const st = h.state();
        return st.vehicles.filter((v) => v.dz > -1500 && v.dz < 36000 && v.kind !== 'ambulancia' && v.kind !== 'contramao').length >= n;
      }, 3, target(t));
      s = await game.state();
      // motos que surgem atrás entram na conta ao passar de 1 500 atrás: podem somar 1 ou 2 além do alvo
      expect(around(s), `densidade em ${t} s`).toBeGreaterThanOrEqual(target(t));
      expect(around(s), `densidade em ${t} s`).toBeLessThanOrEqual(target(t) + 2);
    }
    expect(target(TRAFFIC_RAMP * 2)).toBe(TRAFFIC_MAX);
  });
});
