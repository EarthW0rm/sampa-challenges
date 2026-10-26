import { BONUS_PTS, PTS, SEMAFORO_HITS, WAVE_SECONDS } from '../../src/games/pinball-paulista/game/constants';
import { delta } from './support/rules';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — semáforos e Onda Verde', () => {
  test('PP-RN-09 PP-RN-10 batida vale PTS.bumper, a 6ª dá o extra, 3 verdes ligam a Onda Verde (bumpers em dobro por WAVE_SECONDS)', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: segura-bola longo (a bola não pode ser perdida no teste)
    const hit = async (i: number) => {
      const t = await game.targets();
      const b = t.bumpers[i];
      const before = (await game.state()).bumperHits[i];
      // pré-condição: bola caindo sobre o bumper i
      await game.placeBall(b.x, b.y - 31, 0, 150);
      await game.advanceUntil((h, a) => h.state().bumperHits[a.i] !== a.before, 1, { i, before }, 1);
    };
    let s0 = await game.state();
    await hit(0);
    let s1 = await game.state();
    expect(delta(s0, s1, 'bumper')).toEqual({ n: 1, pts: PTS.bumper });
    expect(s1.bonusBase - s0.bonusBase).toBe(BONUS_PTS.bumper);
    expect(s1.bumperHits).toEqual([1, 0, 0]);

    // pré-condição: semáforo 1 a uma batida do verde e os outros dois já verdes
    await game.lights({ bumperHits: [2 * SEMAFORO_HITS - 1, 2 * SEMAFORO_HITS, 2 * SEMAFORO_HITS] });
    await expect(page.locator('.pinball-paulista .pips i.green')).toHaveCount(2);
    s0 = await game.state();
    await hit(0);
    s1 = await game.state();
    expect(delta(s0, s1, 'semaforoVerde')).toEqual({ n: 1, pts: PTS.semaforoVerde });
    expect(delta(s0, s1, 'ondaVerde')).toEqual({ n: 1, pts: PTS.ondaVerde });
    expect(s1.wave).toBeGreaterThan(WAVE_SECONDS - 0.1);
    expect(s1.bumperHits).toEqual([0, 0, 0]);
    expect(s1.greens).toBe(0);
    await expect(page.locator('.pinball-paulista .chip', { hasText: 'Onda verde' })).toBeVisible();

    // durante a onda: bumper em dobro e a 6ª batida não dá extra nem outra onda
    await game.lights({ bumperHits: [2 * SEMAFORO_HITS - 1, 2 * SEMAFORO_HITS, 2 * SEMAFORO_HITS] }); // pré-condição
    s0 = await game.state();
    await hit(0);
    s1 = await game.state();
    expect(delta(s0, s1, 'bumper')).toEqual({ n: 1, pts: 2 * PTS.bumper });
    expect(delta(s0, s1, 'semaforoVerde').n).toBe(0);
    expect(delta(s0, s1, 'ondaVerde').n).toBe(0);
    expect(s1.greens).toBe(3);

    await game.advanceUntil((h) => h.state().wave <= 0, WAVE_SECONDS + 1, undefined, 30);
    const s = await game.state();
    expect(s.phase).toBe('play');
    expect(s.ball).toBe(1);
    await expect(page.locator('.pinball-paulista .chip', { hasText: 'Onda verde' })).toHaveCount(0);
  });
});
