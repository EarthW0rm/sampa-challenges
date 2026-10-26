import { BALL_R, CY, FOOT_X, HEAD_X } from '../../src/games/sinuca-de-bar/game/constants';
import { groupOf, RULES } from '../../src/games/sinuca-de-bar/game/rules';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — saída', () => {
  test('SB-RN-10 SB-RN-14 mesa armada, saída de quem o menu escolheu e alternância a cada nova partida', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'], breaker: 'p2' });
    const s = await game.state();
    const castigo = RULES.lisas.castigo;
    const dx = (2 * BALL_R + 0.05) * Math.cos(Math.PI / 6);
    expect(s.balls[0]).toMatchObject({ x: HEAD_X - 8, y: CY, on: true });
    const on = s.balls.filter((b) => b.n !== 0);
    expect(on).toHaveLength(15);
    const c = on.find((b) => b.n === castigo)!;
    expect(c.x).toBeCloseTo(FOOT_X + 2 * dx, 6);
    expect(c.y).toBeCloseTo(CY, 6);
    expect(Math.min(...on.map((b) => b.x)), 'ponta na marca do pé').toBeCloseTo(FOOT_X, 6);
    const back = on.filter((b) => Math.abs(b.x - (FOOT_X + 4 * dx)) < 0.01).sort((a, b) => a.y - b.y);
    expect(groupOf(back[0].n, 'lisas')).not.toBe(groupOf(back[4].n, 'lisas'));
    expect(s).toMatchObject({ turn: 1, breaker: 1, isBreak: true, ballInHand: 'kitchen', groups: [null, null] });
    expect(s.toasts).toContain('BIA DA A SAIDA');

    const nova = page.getByRole('button', { name: 'Nova partida' });
    await nova.click();
    await page.getByRole('button', { name: 'Abandonar esta partida?' }).click();
    await game.frames(1);
    expect(await game.state()).toMatchObject({ turn: 0, breaker: 0, isBreak: true });
    await nova.click();
    await page.getByRole('button', { name: 'Abandonar esta partida?' }).click();
    await game.frames(1);
    expect((await game.state()).breaker).toBe(1);
  });

  test('SB-RN-14 Sorteio dá a saída a um dos dois (os dois aparecem em partidas seguidas)', async ({ game, page }) => {
    const seen = new Set<number>();
    await game.start({ mode: 'pvp', breaker: 'random' });
    for (let i = 0; i < 8 && seen.size < 2; i++) {
      if (i > 0) {
        await page.getByRole('button', { name: '← Menu' }).click();
        await game.menu();
      }
      const s = await game.state();
      expect(s.turn).toBe(s.breaker);
      seen.add(s.breaker);
    }
    expect([...seen].sort()).toEqual([0, 1]);
  });

  test('SB-RN-11 branca só atrás da linha de cabeceira (arraste e W A S D)', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.placeCue(60, 80);
    let cue = (await game.state()).balls[0];
    expect(cue.x).toBeCloseTo(60, 0);
    expect(cue.y).toBeCloseTo(80, 0);
    await game.placeCue(150, 80);
    cue = (await game.state()).balls[0];
    expect(cue.x, 'soltou depois da linha: volta ao último lugar válido').toBeLessThanOrEqual(HEAD_X);
    expect((await game.state()).canPlace).toBe(true);
    await game.placeCueKeys('d', 20);
    cue = (await game.state()).balls[0];
    expect(cue.x, 'D não passa da linha').toBeLessThanOrEqual(HEAD_X);
    const y0 = cue.y;
    await game.placeCueKeys('w', 2, true);
    expect((await game.state()).balls[0].y).toBeCloseTo(y0 - 1, 6);
    await game.placeCueKeys('s', 1);
    expect((await game.state()).balls[0].y).toBeCloseTo(y0 + 1, 6);
  });

  test('SB-RN-12 SB-RN-13 saída: encaçapar continua e define grupo; castigo tocada primeiro não é falta e volta para a marca', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara: saída com a bola 3 na reta da caçapa do meio
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 3, x: 160, y: 60 }, { n: 9, x: 250, y: 150 }], { isBreak: true, ballInHand: 'kitchen' });
    let s = await game.shotAt(160, 60, 40);
    expect(s.lastShot).toMatchObject({ isBreak: true, pocketed: [3], foul: null, again: true, assigned: 'A' });
    expect(s).toMatchObject({ turn: 0, groups: ['A', 'B'], isBreak: false });

    // pré-condição rara: saída com a castigo na reta da caçapa
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 8, x: 160, y: 60 }, { n: 9, x: 250, y: 150 }], { isBreak: true, ballInHand: 'kitchen' });
    s = await game.shotAt(160, 60, 40);
    expect(s.lastShot).toMatchObject({ isBreak: true, firstHit: 8, pocketed: [8], foul: null, respotCastigo: true });
    expect(s.winner).toBeNull();
    const c = s.balls.find((b) => b.n === 8)!;
    expect(c.on).toBe(true);
    expect(c.y).toBe(CY);
    expect(c.x).toBeGreaterThanOrEqual(FOOT_X);
    expect(s.toasts).toContain('BOLA 8 NA SAIDA: VOLTA PARA A MARCA');
    expect(s.turn, 'nenhuma numerada caiu de vez: passa').toBe(1);
  });
});
