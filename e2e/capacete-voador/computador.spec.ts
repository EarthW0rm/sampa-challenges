import { ANNOUNCE_MS, THINK_MS } from '../../src/games/capacete-voador/game/constants';
import { FPS } from '../support/game-page';
import type { CapacetePage } from './support/page';
import { expect, test } from './support/test';

/** O jogador 1 passa a vez e o teste espera o tiro do computador terminar; devolve o resultado dele. */
async function computerShot(game: CapacetePage) {
  await game.waitAim(0);
  const before = (await game.state()).outcomes.length;
  await game.passTurn(0);
  await game.advanceUntil((h, n) => h.state().outcomes.length > n + 1 && h.state().phase !== 'exploding', 60, before);
  const s = await game.state();
  const o = s.outcomes.at(-1)!;
  expect(o.by, 'tiro do computador').toBe(1);
  return { o, s };
}

/** Joga rodadas (uma por cidade, Reiniciar entre elas) e devolve em que tiro o computador acertou você. */
async function firstHits(game: CapacetePage, cities: number, maxShots: number): Promise<(number | null)[]> {
  const out: (number | null)[] = [];
  for (let c = 0; c < cities; c++) {
    let hitAt: number | null = null;
    for (let n = 1; n <= maxShots && hitAt === null; n++) {
      const { o } = await computerShot(game);
      if (o.index === 0) hitAt = n;
    }
    out.push(hitAt);
    await game.restart();
  }
  return out;
}

test.describe('Capacete Voador — computador', () => {
  test('CV-RN-27 vez do computador: Mirando… por 0,8 s, mostra o tiro por 0,9 s e lança', async ({ game }) => {
    await game.play({ mode: 'pvc', difficulty: 'facil' });
    const b = await game.harmless(0);
    await game.aim(b.angle, b.velocity, 0);
    await game.fire('enter', 0);
    // quadro a quadro até o 1º quadro do computador pensando
    await game.advanceUntil((h) => h.state().phase === 'thinking', 30, undefined, 1);
    await expect(game.panel(1).locator('.thinking')).toHaveText('Mirando…');
    await expect(game.panel(0).locator('.aim-form'), 'sem formulário na vez do computador').toHaveCount(0);
    const think = Math.round((THINK_MS / 1000) * FPS);
    await game.frames(think - 3);
    expect((await game.state()).computerShot, 'ainda pensando').toBeNull();
    await game.frames(5);
    const s = await game.state();
    const shot = s.computerShot!;
    expect(shot).not.toBeNull();
    await expect(game.panel(1).locator('.computer-shot')).toContainText(`Ângulo: ${shot.angle}`);
    await expect(game.panel(1).locator('.computer-shot')).toContainText(`Velocidade: ${shot.velocity}`);
    const announce = Math.round((ANNOUNCE_MS / 1000) * FPS);
    await game.frames(announce - 5);
    expect((await game.state()).phase, 'ainda mostrando o tiro').toBe('thinking');
    await game.frames(5);
    const f = await game.state();
    expect(f.phase).toBe('flying');
    expect(f.lastShots[1]).toEqual(shot);
  });

  test('CV-RN-28 fácil nunca acerta ninguém (3 cidades, 3 tiros em cada)', async ({ game }) => {
    await game.play({ mode: 'pvc', difficulty: 'facil' });
    const hits = await firstHits(game, 3, 3);
    expect(hits).toEqual([null, null, null]);
    const s = await game.state();
    expect(s.damage).toEqual([0, 0]);
  });

  test('CV-RN-29 médio acerta você até o 5º tiro da rodada', async ({ game }) => {
    await game.play({ mode: 'pvc', difficulty: 'medio' });
    const hits = await firstHits(game, 2, 5);
    for (const h of hits) expect(h, `1º acerto do médio: ${JSON.stringify(hits)}`).not.toBeNull();
  });

  test('CV-RN-30 difícil acerta você até o 3º tiro da rodada', async ({ game }) => {
    await game.play({ mode: 'pvc', difficulty: 'dificil' });
    const hits = await firstHits(game, 3, 3);
    for (const h of hits) expect(h, `1º acerto do difícil: ${JSON.stringify(hits)}`).not.toBeNull();
  });
});
