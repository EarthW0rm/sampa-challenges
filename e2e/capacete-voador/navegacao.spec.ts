import { expect, test } from './support/test';

test.describe('Capacete Voador — navegação', () => {
  test('CV-RN-01 abre no menu, começa a partida com o gancho e volta ao hub pela barra', async ({ game, page }) => {
    await game.open();
    expect(await game.hasHook(), 'sem partida, sem motor').toBe(false);
    await game.start();
    const s = await game.state();
    expect(s.mode).toBe('pvc');
    expect(s.round).toBe(1);
    expect(s.phase).toBe('aiming');
    await game.evidence('Partida aberta: cabeçalho com modo, rodada, placar, vez, vento, mira, motos e capacete');
    expect(await game.rafPending(), 'um laço de quadros vivo').toBe(1);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
    expect(await game.hasHook(), 'gancho removido no cleanup').toBe(false);
    expect(await game.rafPending(), 'laço cancelado').toBe(0);
  });
});
