import { CORRIDORS, GRAU_ITEM, GRAU_START, LANES, MAX_LIVES, SPAWN_AHEAD_MIN, SPEED_ITEM_FACTOR, SPEED_ITEM_TIME, START_LIVES } from '../../src/games/corredor-sp/game/constants';
import { MODELS } from '../../src/games/corredor-sp/game/data';
import type { ItemKind } from '../../src/games/corredor-sp/game/engine';
import { FPS } from '../support/game-page';
import type { CorredorPage } from './support/page';
import { expect, test } from './support/test';

const entregadora = MODELS.find((m) => m.id === 'entregadora')!;

/** Põe um item na linha da moto e pilota até pegá-lo. */
async function pick(game: CorredorPage, kind: ItemKind) {
  // pré-condição: item posto pelo teste na linha da moto
  await game.prepare((h, k) => h.prepare.thing(k, h.state().player.x, 3000), kind);
  return game.drive({ frames: 600, x: 0, until: (st) => st.items.length === 0, label: `Pilotar até pegar o item ${kind}` });
}

test.describe('Corredor SP — itens', () => {
  test('CS-RN-14 pacote, grau (até 100%), vida (até o teto) e velocidade (+15% por 8 s, renova)', async ({ game }) => {
    // pré-condição: pista vazia
    await game.race({ track: 'radial-leste' }, { calm: true });
    let s = await pick(game, 'pacote');
    expect(s.packages).toBe(1);
    expect(s.popups).toContain('+1 PACOTE');
    s = await pick(game, 'grau');
    expect(s.player.grau).toBeCloseTo(GRAU_START + GRAU_ITEM, 5);
    s = await pick(game, 'grau');
    expect(s.player.grau, 'barra até 100%').toBe(1);
    s = await pick(game, 'vida');
    expect(s.player.lives).toBe(START_LIVES + 1);
    await game.prepare((h, n) => h.prepare.lives(n), MAX_LIVES); // pré-condição: vidas no teto
    s = await pick(game, 'vida');
    expect(s.player.lives, 'teto de vidas').toBe(MAX_LIVES);
    s = await game.drive({ frames: 600, x: 0 });
    expect(s.player.kmh).toBeCloseTo(entregadora.vmax, 2);
    s = await pick(game, 'velocidade');
    expect(s.player.boostT).toBeGreaterThan(SPEED_ITEM_TIME - 0.5);
    s = await game.drive({ frames: 4 * FPS, x: 0 });
    expect(s.player.kmh, 'teto ×1,15').toBeCloseTo(entregadora.vmax * SPEED_ITEM_FACTOR, 0);
    s = await pick(game, 'velocidade');
    expect(s.player.boostT, 'pegar outro reinicia os 8 s').toBeGreaterThan(SPEED_ITEM_TIME - 0.5);
    s = await game.drive({ frames: Math.round((SPEED_ITEM_TIME + 1) * FPS), x: 0 });
    expect(s.player.boostT).toBeLessThanOrEqual(0);
    expect(s.player.kmh, 'acabou o turbo, volta ao teto do modelo').toBeCloseTo(entregadora.vmax, 2);
  });

  test('CS-RN-15 um item a cada 1,8–3,2 s, a 22 000 à frente numa faixa ou corredor; no teto de vidas não vem vida', async ({ game }) => {
    await game.race({ track: '23-de-maio' });
    // a moto fica parada na terra, longe do trânsito (as motos que passam por cima derrubariam)
    await game.steerTo(1.2);
    await game.frames(2 * FPS - 6 - Math.round((await game.state()).time * FPS));
    expect((await game.state()).items, 'o 1º item vem aos 2 s').toHaveLength(0);
    await game.frames(8);
    let s = await game.state();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].dz).toBeCloseTo(SPAWN_AHEAD_MIN, 0);
    // a moto fica parada: os itens se acumulam onde surgiram
    await game.frames(58 * FPS);
    s = await game.state();
    const n = s.items.length;
    expect(n).toBeGreaterThanOrEqual(1 + Math.floor(58 / 3.2));
    expect(n).toBeLessThanOrEqual(1 + Math.ceil(58 / 1.8));
    const spots = [...LANES, ...CORRIDORS];
    for (const it of s.items) expect(spots).toContain(it.x);
    const count = (k: ItemKind) => s.items.filter((i) => i.kind === k).length;
    expect(count('pacote'), 'pacote é o mais sorteado').toBeGreaterThan(Math.max(count('capacete'), count('grau'), count('velocidade'), count('vida')));
    await game.prepare((h, m) => h.prepare.lives(m), MAX_LIVES); // pré-condição: vidas no teto
    await game.frames(40 * FPS);
    s = await game.state();
    expect(s.player.lives).toBe(MAX_LIVES);
    const after = s.items.slice(n);
    expect(after.length).toBeGreaterThan(5);
    expect(after.filter((i) => i.kind === 'vida'), 'vida sorteada vira pacote').toHaveLength(0);
  });
});
