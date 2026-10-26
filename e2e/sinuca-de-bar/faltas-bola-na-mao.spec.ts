import { BALL_R, CY, HEAD_X } from '../../src/games/sinuca-de-bar/game/constants';
import { expect, test } from './support/test';
import type { SinucaPage } from './support/page';

const LISAS: ['A', 'B'] = ['A', 'B'];

/** Taca de (100, 112) na bola em (150, 112) com 20%: a primeira tocada é a do meio. */
async function hitMiddle(game: SinucaPage, n: number, others: { n: number; x: number; y: number }[], groups: ['A', 'B'] | [null, null]) {
  // pré-condição rara: mesa de uma falta
  await game.setTable([{ n: 0, x: 100, y: 112 }, { n, x: 150, y: 112 }, ...others], { groups });
  return game.shotAt(150, 112, 20);
}

test.describe('Sinuca de Bar — faltas e bola na mão', () => {
  test('SB-RN-19 SB-RN-24 não tocou em nenhuma bola; adversário com bola na mão em qualquer lugar', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    // pré-condição rara: só a 1 e a 8 longe da reta
    await game.setTable([{ n: 0, x: 100, y: 112 }, { n: 1, x: 250, y: 60 }, { n: 8, x: 250, y: 160 }], { groups: LISAS });
    let s = await game.shotAt(30, 112, 20);
    expect(s.lastShot).toMatchObject({ firstHit: null, foul: 'Não tocou em nenhuma bola' });
    expect(s).toMatchObject({ turn: 1, ballInHand: 'anywhere' });
    expect(s.toasts.filter((t) => t === 'FALTA: NAO TOCOU EM NENHUMA BOLA'), 'aviso da falta aparece uma vez').toHaveLength(1);
    await expect(page.getByText('Bia tem bola na mão: posicione a branca e dê a tacada.')).toBeVisible();

    // arrasta a branca para além da linha de cabeceira (vale em qualquer lugar)
    await game.placeCue(200, 100);
    s = await game.state();
    expect(s.balls[0].x).toBeCloseTo(200, 0);
    expect(s.balls[0].x).toBeGreaterThan(HEAD_X);
    // soltar em cima de outra bola: volta ao último lugar válido
    await game.placeCue(250, 60, 4);
    s = await game.state();
    expect(Math.hypot(s.balls[0].x - 250, s.balls[0].y - 60)).toBeGreaterThan(2 * BALL_R);
    expect(s.canPlace).toBe(true);
    // toque longe da branca mira, não arrasta
    const before = s.balls[0];
    await game.aimAt(before.x, before.y + 40);
    s = await game.state();
    expect(s.balls[0]).toMatchObject({ x: before.x, y: before.y });
    expect(s.draggingCue).toBe(false);
    await game.placeCueKeys('a', 3);
    expect((await game.state()).balls[0].x).toBeCloseTo(before.x - 6, 6);
    await game.placeCueKeys('a', 2, true);
    expect((await game.state()).balls[0].x).toBeCloseTo(before.x - 7, 6);
  });

  test('SB-RN-20 tocou primeiro na bola do adversário', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    const s = await hitMiddle(game, 9, [{ n: 1, x: 250, y: 60 }, { n: 8, x: 250, y: 160 }], LISAS);
    expect(s.lastShot).toMatchObject({ firstHit: 9, foul: 'Tocou primeiro na bola do adversário' });
    expect(s).toMatchObject({ turn: 1, ballInHand: 'anywhere' });
  });

  test('SB-RN-21 tocou primeiro na castigo antes da hora (com grupo e com a mesa aberta)', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    let s = await hitMiddle(game, 8, [{ n: 1, x: 250, y: 60 }], LISAS);
    expect(s.lastShot).toMatchObject({ firstHit: 8, foul: 'Tocou primeiro na bola 8' });
    expect(s).toMatchObject({ turn: 1, ballInHand: 'anywhere' });
    s = await hitMiddle(game, 8, [{ n: 1, x: 250, y: 60 }], [null, null]);
    expect(s.lastShot).toMatchObject({ firstHit: 8, foul: 'Tocou primeiro na bola 8' });
  });

  test('SB-RN-22 na castigo, tocar outra bola primeiro é falta', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    const s = await hitMiddle(game, 9, [{ n: 8, x: 250, y: 60 }], LISAS);
    expect(s.lastShot).toMatchObject({ firstHit: 9, foul: 'Tinha que tocar primeiro na bola 8' });
    expect(s.winner).toBeNull();
  });

  test('SB-RN-23 a branca caiu: volta perto da marca e o adversário tem bola na mão', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara: branca na reta da caçapa do meio, sem bola no caminho
    await game.setTable([{ n: 0, x: 160, y: 90 }, { n: 1, x: 250, y: 150 }, { n: 8, x: 60, y: 160 }], { groups: LISAS });
    const s = await game.shotAt(160, 30, 40);
    expect(s.lastShot).toMatchObject({ pocketed: [0], respotCue: true, foul: 'A branca caiu e não tocou em nenhuma bola' });
    expect(s.balls[0]).toMatchObject({ on: true, x: HEAD_X - 8, y: CY });
    expect(s).toMatchObject({ turn: 1, ballInHand: 'anywhere' });
  });
});
