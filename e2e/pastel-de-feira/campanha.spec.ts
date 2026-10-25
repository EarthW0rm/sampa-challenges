import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { SAVE_KEY } from './support/campaign';
import { expect, test } from './support/game';

const patch = (fn: (c: Campaign) => Campaign) => ({ patch: fn });

/** RN-17, RN-50–57, RN-151 (reivindicação), JA-07, JA-08. */
test.describe('Campanha', () => {
  test('RN-52: caixa negativo depois do fechamento encerra a campanha (Fim de campanha)', async ({ game, page }) => {
    await game.startDay({ campaign: patch((c) => ({ ...c, cash: 0, owned: { ...c.owned, extraM2: 5 } })) });
    await game.runToEnd();
    await expect(page.getByText('Caixa negativo: a barraca faliu.')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Fim de campanha' })).toBeVisible();
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(saved.phase).toBe('fim');
    // antes do dia 10 não há passar o ponto na falência
    await expect(page.getByRole('button', { name: /Passar o ponto/ })).toHaveCount(0);
  });

  test('RN-52/RN-57: falência a partir do dia 10 oferece passar o ponto por 25% do investido', async ({ game, page }) => {
    await game.startDay({ campaign: patch((c) => ({ ...c, day: 10, calendar: 10, cash: 0, owned: { ...c.owned, extraM2: 5, spent: 1000 } })) });
    await game.runToEnd();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('button', { name: 'Passar o ponto (R$ 250,00)' })).toBeVisible();
  });

  test('JA-07/RN-54: em modo livre o Preparo não mostra meta e oferece passar o ponto', async ({ game, page }) => {
    await game.boot({ campaign: patch((c) => ({ ...c, day: 21, calendar: 21, freeMode: true, cash: 1000, owned: { ...c.owned, spent: 600 } })) });
    await game.continueToPrep();
    const head = page.locator('.pastel-de-feira .prep-head');
    await expect(head).toContainText('modo livre');
    await expect(head).toContainText('Sem meta');
    await page.getByRole('button', { name: 'Passar o ponto' }).click();
    const dialog = page.getByRole('dialog', { name: 'Passar o ponto' });
    await expect(dialog).toContainText('Valor do ponto: R$ 1.300,00'); // caixa + 50% de R$ 600
    await dialog.getByRole('button', { name: 'Passar o ponto' }).click();
    await expect(page.getByRole('heading', { name: 'Nova campanha' })).toBeVisible();
    await page.getByText('Negociante').click();
    await page.getByRole('button', { name: 'Começar' }).click();
    // R$ 200 + 20% de R$ 1.300 (Negociante não tem bônus de caixa)
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Caixa R$ 460,00');
    expect(await page.evaluate(() => localStorage.getItem('pastel-de-feira:recorde-ponto'))).toBe('1300');
  });

  test('JA-08: o texto do diálogo de passar o ponto bate com o caixa que a campanha nova recebe (perfil Tradicional)', async ({ game, page }) => {
    await game.boot({ campaign: patch((c) => ({ ...c, day: 21, calendar: 21, freeMode: true, cash: 1000, owned: { ...c.owned, spent: 600 } })) });
    await game.continueToPrep();
    await page.getByRole('button', { name: 'Passar o ponto' }).click();
    const dialog = page.getByRole('dialog', { name: 'Passar o ponto' });
    // o texto mostra o caixa da campanha nova sem e com o bônus do Tradicional (+ R$ 100)
    const text = (await dialog.textContent())!.replace(/\s+/g, ' ');
    expect(text).toContain('começa com R$ 460,00 no caixa');
    const promised = text.match(/\((R\$ [\d.,]+) com o perfil Tradicional\)/)![1];
    await dialog.getByRole('button', { name: 'Passar o ponto' }).click();
    await page.getByRole('button', { name: 'Começar' }).click(); // perfil padrão: Tradicional
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText(`Caixa ${promised}`);
  });

  test('RN-17: no dia 5 o Preparo pede o tema; a primeira escolha é grátis', async ({ game, page }) => {
    await game.boot({ campaign: patch((c) => ({ ...c, day: 5, calendar: 5 })) });
    await game.continueToPrep();
    const dialog = page.getByRole('dialog', { name: 'Tema da barraca' });
    await expect(dialog).toContainText('A primeira escolha é grátis.');
    const cash = await page.locator('.pastel-de-feira .prep-head div').nth(1).textContent();
    await dialog.locator('li.item', { hasText: 'Popular' }).getByRole('button', { name: 'Escolher' }).click();
    await expect(page.getByRole('button', { name: 'Tema: popular' })).toBeVisible();
    await expect(page.locator('.pastel-de-feira .prep-head div').nth(1)).toHaveText(cash!);
  });

  test('RN-17: trocar de tema depois custa R$ 500', async ({ game, page }) => {
    await game.boot({ campaign: patch((c) => ({ ...c, day: 6, calendar: 6, theme: 'popular', cash: 600 })) });
    await game.continueToPrep();
    await page.getByRole('button', { name: 'Tema: popular' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tema da barraca' });
    await dialog.locator('li.item', { hasText: 'Gourmet' }).getByRole('button', { name: 'R$ 500,00' }).click();
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Caixa R$ 100,00');
  });

  test('RN-151: reivindicação pendente bloqueia a abertura até ser respondida', async ({ game, page }) => {
    await game.boot({ campaign: patch((c) => ({ ...c, day: 4, calendar: 4, claim: 'pendente' })) });
    await game.continueToPrep();
    const open = page.getByRole('button', { name: 'Abrir a feira' });
    await expect(open).toBeDisabled();
    const dialog = page.getByRole('dialog', { name: 'Reivindicação da equipe' });
    await expect(dialog.getByRole('button', { name: /Pausa/ })).toBeDisabled(); // sem área de descanso
    await dialog.getByRole('button', { name: /Recusar/ }).click();
    await expect(open).toBeEnabled();
  });

  test('RN-140: o Preparo mostra a estação do dia (dias 1–5 verão, 6–10 outono)', async ({ game, page }) => {
    await game.boot();
    await game.continueToPrep();
    await expect(page.getByRole('region', { name: 'Previsão do dia' })).toContainText('Verão');
  });

  test('RN-56: o card do hub mostra o recorde de dia concluído', async ({ game, page }) => {
    await game.boot({ storage: { 'pastel-de-feira:recorde': '7' } });
    await page.goto('./#/');
    await expect(page.locator('.hub-card', { hasText: 'Pastel de Feira' })).toContainText('Recorde dia 7');
  });
});
