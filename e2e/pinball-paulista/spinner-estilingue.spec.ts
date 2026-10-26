import { BONUS_PTS, PTS, SLING_KICK } from '../../src/games/pinball-paulista/game/constants';
import { delta, expectedBase, tallyTotal } from './support/rules';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — spinner, estilingues e corredores', () => {
  test('PP-RN-18 spinner: PTS.spinner por meia volta, fora do bônus de fim de bola', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida no teste
    const t = await game.targets();
    const sp = t.spinners[0];
    // pré-condição: bola subindo rápido pelo corredor esquerdo
    await game.placeBall(sp.x, sp.y + 25, 0, -420);
    await game.ev.quiet(() => game.frames(30));
    const s = await game.state();
    expect(s.spin[0].w).toBeGreaterThan(0);
    const spin = s.tally.spinner!;
    expect(spin.n).toBeGreaterThan(0);
    expect(spin.pts).toBe(spin.n * PTS.spinner);
    expect(tallyTotal(s.tally)).toBe(s.score);
    expect(s.bonusBase, 'spinner não entra no bônus').toBe(expectedBase(s.tally));
  });

  test('PP-RN-19 estilingue chuta com SLING_KICK (±), PTS.estilingue e BONUS_PTS.estilingue', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida no teste
    const s0 = await game.state();
    // pré-condição: bola descendo contra a face do estilingue esquerdo
    await game.placeBall(70, 280, -150, 80);
    await game.advanceUntil((h) => (h.state().tally.estilingue?.n ?? 0) > 0, 1, undefined, 1);
    const s = await game.state();
    expect(delta(s0, s, 'estilingue')).toEqual({ n: 1, pts: PTS.estilingue });
    expect(s.bonusBase - s0.bonusBase).toBe(BONUS_PTS.estilingue);
    const v = Math.hypot(s.balls[0].vx, s.balls[0].vy);
    expect(v).toBeGreaterThan(SLING_KICK * 0.8);
    expect(v).toBeLessThan(SLING_KICK * 1.4);
    expect(s.balls[0].vx, 'chutada para dentro da mesa').toBeGreaterThan(0);
  });

  test('PP-RN-20 o fundo inclinado do corredor devolve a bola para dentro da mesa', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida no teste
    // pré-condição: bola caindo dentro do corredor esquerdo
    await game.placeBall(18, 140, 0, 50);
    await game.advanceUntil((h) => h.state().balls[0].x > 36, 3, undefined, 2);
    expect((await game.state()).balls[0].y).toBeGreaterThan(190);
  });
});
