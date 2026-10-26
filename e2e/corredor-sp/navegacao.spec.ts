import { START_LIVES } from '../../src/games/corredor-sp/game/constants';
import { expect, test } from './support/test';

test.describe('Corredor SP — navegação e gancho', () => {
  test('CS-RN-04 abre a escolha, larga, mostra o estado e volta ao hub', async ({ game, page }) => {
    await game.open();
    await expect(game.setupTitle).toBeVisible();
    expect(await game.hasHook(), 'sem motor na tela de escolha não há gancho').toBe(false);
    await game.start();
    let s = await game.state();
    expect(s.phase).toBe('countdown');
    expect(s.player.lives).toBe(START_LIVES);
    await game.frames(200);
    await game.accelerate(60);
    s = await game.state();
    expect(s.phase).toBe('racing');
    expect(s.player.kmh).toBeGreaterThan(0);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
    expect(await game.hasHook(), 'cleanup apagou o gancho').toBe(false);
    expect(await game.lastHook((h) => h.state().phase)).toBe('racing');
  });

  test('gancho ausente sem a flag de teste', async ({ page }) => {
    await page.goto('./#/jogos/corredor-sp');
    await page.getByRole('button', { name: 'Correr!' }).click();
    await expect(page.locator('.corredor-sp canvas')).toBeVisible();
    expect(await page.evaluate(() => typeof (window as unknown as { __e2e?: unknown }).__e2e)).toBe('undefined');
  });
});
