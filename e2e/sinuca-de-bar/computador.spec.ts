import { LEVELS, type Level } from '../../src/games/sinuca-de-bar/game/ai';
import { AI_AIM_S, AI_THINK_S, CY, FOOT_X } from '../../src/games/sinuca-de-bar/game/constants';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — computador', () => {
  test('SB-RN-31 vez do computador: pensa, gira o taco e bate; controles e força travados', async ({ game, page }) => {
    await game.start({ mode: 'pvc', level: 1, names: ['Ana'], breaker: 'p2' });
    await expect(page.getByText('Computador está mirando…')).toBeVisible();
    await expect(game.shootButton).toBeDisabled();
    await expect(game.powerBar, 'a força não muda na vez do computador').toBeDisabled();
    await game.frames(1);
    const aim0 = (await game.state()).aim;
    await page.locator('.sinuca-de-bar .hint').click();
    await game.pressKey('ArrowLeft');
    expect((await game.state()).aim, 'teclado não age na vez do computador').toBe(aim0);
    // pensa pelo menos AI_THINK_S (a resposta do worker chega em tempo real)
    await expect.poll(async () => (await game.state()).cpu?.ready).toBe(true);
    await game.frames(Math.floor(AI_THINK_S * 60) - 3);
    expect((await game.state()).cpu?.stage).toBe('think');
    await game.advanceUntil((h) => h.state().cpu?.stage === 'aim', 1, undefined, 1);
    let f = 0;
    while ((await game.state()).phase === 'aim') {
      await game.frames(1);
      f++;
      expect(f).toBeLessThanOrEqual(Math.ceil(AI_AIM_S * 60) + 2);
    }
    expect(f, 'gira o taco por AI_AIM_S').toBeGreaterThanOrEqual(Math.floor(AI_AIM_S * 60) - 1);
    const s = await game.state();
    expect(s.phase).toBe('stroke');
    expect(s.aim).toBeCloseTo(s.ai.lastShot!.angle, 9);
    expect(s.power).toBeCloseTo(s.ai.lastShot!.power, 9);
  });

  test('SB-RN-32 erro de mira por nível: Pato > Bom de taco > Tubarão (saídas com semente fixa)', async ({ game, page }) => {
    test.setTimeout(90_000);
    const mean: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
    const N = 8;
    await game.open({ seed: 11 });
    for (const level of [1, 2, 3] as Level[]) {
      await game.menu({ mode: 'pvc', level, breaker: 'p2' });
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const before = (await game.state()).ai.received;
        // pré-condição rara: devolve a saída ao computador para medir outra tacada sem jogar a partida
        await game.hook((h) => h.prepare.turn(1, { isBreak: true, ballInHand: 'kitchen' }));
        await game.frames(1);
        await expect.poll(async () => (await game.state()).ai.received).toBeGreaterThan(before);
        const shot = (await game.state()).ai.lastShot!;
        const ideal = Math.atan2(CY - shot.cue!.y, FOOT_X - shot.cue!.x);
        sum += Math.abs(shot.angle - ideal);
      }
      mean[level] = ((sum / N) * 180) / Math.PI;
      await game.evidence(`Nível ${LEVELS[level].label}: erro médio ${mean[level].toFixed(2)}°`);
      await page.getByRole('button', { name: '← Menu' }).click();
    }
    expect(mean[1], JSON.stringify(mean)).toBeGreaterThan(mean[2]);
    expect(mean[2], JSON.stringify(mean)).toBeGreaterThan(mean[3]);
    expect(mean[3], 'Tubarão quase não erra').toBeLessThan(LEVELS[1].aimNoiseDeg);
  });
});
