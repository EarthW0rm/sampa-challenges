import { expect, HUB_GAMES, test } from './test';

test.describe('Hub — rotas', () => {
  for (const g of HUB_GAMES) {
    test(`HUB-RN-51 #/jogos/${g.id} abre o jogo e a barra volta à home`, async ({ game, page }) => {
      await game.open();
      await page.goto(`./#/jogos/${g.id}`);
      await game.waitGame(g.id);
      await expect(page.locator('.hub-bar-title')).toHaveText(g.title);
      await expect(page).toHaveTitle(`${g.title} · Sampa Challenges`);
      await game.back();
      expect(await page.evaluate(() => location.hash)).toBe('#/');
    });
  }

  test('HUB-RN-51 id inexistente mostra "não encontrado" com link de volta', async ({ game, page }) => {
    await game.open();
    await page.goto('./#/jogos/nao-existe');
    await expect(page.locator('.hub-message')).toContainText('Jogo “nao-existe” não encontrado.');
    await page.getByRole('link', { name: 'Voltar para os jogos' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });

  test('HUB-RN-51 rota fora do padrão (maiúsculas, barra extra) mostra a home', async ({ game, page }) => {
    await game.open();
    for (const hash of ['#/jogos/Cachorro-Loko', '#/jogos/cachorro-loko/extra', '#/qualquer']) {
      await page.goto(`./${hash}`);
      await expect(page.locator('.hub-home'), hash).toBeVisible();
    }
  });

  test('HUB-RN-51 voltar do navegador retorna à home', async ({ game, page }) => {
    await game.open();
    await game.openGame('cachorro-loko');
    await page.goBack();
    await expect(page.locator('.hub-home')).toBeVisible();
    await expect(page.locator('.cachorro-loko')).toHaveCount(0);
  });
});
