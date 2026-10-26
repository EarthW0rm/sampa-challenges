import { LEVELS } from '../../src/games/sinuca-de-bar/game/ai';
import { RULES } from '../../src/games/sinuca-de-bar/game/rules';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — navegação', () => {
  test('SB-RN-03 abre pelo hub, entra na partida, ← Menu volta ao menu e a barra volta ao hub', async ({ game, page }) => {
    await game.open();
    expect(await game.hasHook(), 'no menu ainda não há motor').toBe(false);
    await game.menu();
    const s = await game.state();
    expect(s.mode).toBe('pvc');
    expect(s.rules).toBe('lisas');
    await expect(page.locator('.sinuca-de-bar .mode-label')).toHaveText(
      `Contra o computador (${LEVELS[2].label}) · ${RULES.lisas.names.A} × ${RULES.lisas.names.B} · mata a ${RULES.lisas.castigo}`,
    );
    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
    expect(await game.hasHook(), 'gancho desmontado com a partida').toBe(false);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });
});
