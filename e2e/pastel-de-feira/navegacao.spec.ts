import { SAVE_KEY } from './support/campaign';
import { expect, ROUTE, test } from './support/game';

/** Hub, título, nova campanha e save (RN-51, RN-55, RN-56, RN-110, spec 4: save corrompido e modo privado). */
test.describe('Hub, título e campanha', () => {
  test('hub: o card do Pastel de Feira abre o jogo e a barra volta ao hub', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await page.goto('./#/');
    const card = page.locator('.hub-card', { hasText: 'Pastel de Feira' });
    await expect(card).toBeVisible();
    await card.getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Pastel de Feira' })).toBeVisible();
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.getByRole('heading', { name: 'SAMPA CHALLENGES' })).toBeVisible();
  });

  test('título sem save: só Nova campanha e Sair', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await expect(page.getByRole('button', { name: /^Continuar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova campanha' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  });

  test('RN-51/RN-110: nova campanha Tradicional começa no dia 1 com R$ 300,00 e reputação 3,0', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await expect(page.getByRole('heading', { name: 'Nova campanha' })).toBeVisible();
    await page.getByRole('checkbox', { name: /Tutorial/ }).uncheck();
    await page.getByRole('button', { name: 'Começar' }).click();
    const head = page.locator('.pastel-de-feira .prep-head');
    await expect(head).toContainText('Dia 1');
    await expect(head).toContainText('Caixa R$ 300,00');
    await expect(head).toContainText('3,0');
    // RN-50: meta do dia 1 = R$ 70,00 e reputação 2,0+
    await expect(head).toContainText('Meta: lucro R$ 70,00 · reputação 2,0+');
  });

  test('RN-110: perfil Negociante começa com R$ 200,00 (sem o bônus do Tradicional)', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await page.getByText('Negociante').click();
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Caixa R$ 200,00');
  });

  test('RN-55: a campanha é salva no Preparo e "Continuar (dia 1)" volta a ela depois de recarregar', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.locator('.pastel-de-feira .prep')).toBeVisible();
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY);
    expect(saved?.phase).toBe('preparo');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Continuar (dia 1)' })).toBeVisible();
  });

  test('RN-55: Nova campanha com save existente pede confirmação antes de apagar', async ({ game, page }) => {
    await game.boot();
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await expect(page.getByText('Isso apaga a campanha salva. Tem certeza?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('button', { name: /^Continuar/ })).toBeVisible();
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await page.getByRole('button', { name: 'Sim, apagar e começar outra' }).click();
    await expect(page.getByRole('heading', { name: 'Nova campanha' })).toBeVisible();
  });

  test('spec 4: save corrompido é ignorado com aviso e sem travar', async ({ game, page }) => {
    await game.boot({ rawSave: '{"version":1,"phase":"preparo","campaign":{"day":"x"' });
    await expect(page.getByText('Progresso salvo inválido — nova campanha.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Continuar/ })).toHaveCount(0);
  });

  test('spec 4: save de versão desconhecida é tratado como corrompido', async ({ game, page }) => {
    await game.boot({ rawSave: JSON.stringify({ version: 999, phase: 'preparo', campaign: {} }) });
    await expect(page.getByText('Progresso salvo inválido — nova campanha.')).toBeVisible();
  });

  test('spec 4: armazenamento bloqueado (modo privado): o jogo funciona e avisa', async ({ game, page }) => {
    await game.boot({ campaign: null, blockStorage: true });
    await expect(page.getByText('O navegador bloqueou o armazenamento: o progresso não será salvo.')).toBeVisible();
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await page.getByRole('checkbox', { name: /Tutorial/ }).uncheck();
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.locator('.pastel-de-feira .prep')).toBeVisible();
  });

  test('Sair no título volta ao hub', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('rota direta abre o jogo', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await expect(page).toHaveURL(new RegExp(ROUTE.replace('/', '\\/')));
  });
});
