import { H, PLAYER_SIZE, PLAYER_SPEED, W } from '../../src/games/__ID__/game/constants';
import { expect, test } from './support/test';

test.describe('__TITULO__ — navegação', () => {
  test('__SIGLA__-RN-01 abre, anda 60 quadros com a seta e não sai da tela', async ({ game, page }) => {
    await game.open();
    const start = await game.player();
    await game.move('ArrowRight', 60);
    const after = await game.player();
    // 60 quadros = 1 s de jogo
    expect(after.x - start.x).toBeCloseTo(Math.min(PLAYER_SPEED, W - PLAYER_SIZE - start.x), 0);
    await game.move('ArrowDown', 60 * 10);
    expect((await game.player()).y).toBe(H - PLAYER_SIZE);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });
});
