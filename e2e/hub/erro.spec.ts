import { expect, test } from './test';

test.describe('Hub — erro de um jogo', () => {
  test('HUB-RN-54 falha ao carregar o módulo do jogo cai no tratamento de erro do hub', async ({ game, page }) => {
    await page.route('**/src/games/sinuca-de-bar/Game.tsx*', (r) => r.fulfill({ contentType: 'application/javascript', body: "throw new Error('falha de carga simulada');" }));
    await game.open();
    await game.card('sinuca-de-bar').locator('a').click();
    await expect(page.locator('.hub-message')).toContainText('O jogo travou: falha de carga simulada');
    await expect(page.locator('.hub-bar')).toBeVisible();
    await page.getByRole('link', { name: 'Voltar para os jogos' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
    // erro provocado de propósito: o React registra o erro capturado no console
    game.errors.length = 0;
  });

  test('HUB-RN-54 erro de execução do jogo cai no tratamento de erro do hub, sem tela branca', async ({ game, page }) => {
    await page.route('**/src/games/xadrez-paulistano/Game.tsx*', (r) =>
      r.fulfill({ contentType: 'application/javascript', body: "export default function Quebrado() { throw new Error('falha de execução simulada'); }" }),
    );
    await game.open();
    await game.card('xadrez-paulistano').locator('a').click();
    await expect(page.locator('.hub-message')).toContainText('O jogo travou: falha de execução simulada');
    await game.back();
    // erro provocado de propósito: o React registra o erro capturado no console
    game.errors.length = 0;
  });
});
