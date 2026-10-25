import { STOCK_CAPACITY } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test } from './support/game';

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Preparo (RN-10, RN-32, RN-36, RN-36a, RN-38, RN-53, RN-171). */
test.describe('Preparo', () => {
  const emptyCampaign = { stock: {}, consumables: {} };

  test('RN-171: no dia 1 aparecem só Insumos, Cardápio e Melhorias', async ({ game, page }) => {
    await game.boot({ campaign: emptyCampaign });
    await game.continueToPrep();
    const tabs = await page.getByRole('tab').allTextContents();
    expect(tabs).toEqual(['Insumos', 'Cardápio', 'Melhorias']);
  });

  test('RN-171: Equipe aparece no dia 2 e Associação no dia 3', async ({ game, page }) => {
    await game.boot({ campaign: { ...emptyCampaign, patch: (c) => ({ ...c, day: 3, calendar: 3 }) } });
    await game.continueToPrep();
    const tabs = await page.getByRole('tab').allTextContents();
    expect(tabs).toEqual(expect.arrayContaining(['Equipe', 'Associação']));
  });

  test('RN-32: comprar 5 massas debita R$ 4,00 do caixa e entra no estoque', async ({ game, page }) => {
    await game.boot({ campaign: emptyCampaign });
    await game.continueToPrep();
    const head = page.locator('.pastel-de-feira .prep-head');
    await expect(head).toContainText('Caixa R$ 300,00');
    const row = page.locator('.pastel-de-feira li.item', { hasText: 'Massa' });
    await row.getByRole('button', { name: 'Aumentar' }).click();
    await row.getByRole('button', { name: 'Comprar' }).click();
    await expect(head).toContainText(`Caixa ${money(300 - 5 * 0.8)}`);
    await expect(row).toContainText('tem 5');
  });

  test('RN-36: nos dias 1–3 "Usar sugerida" preenche a compra e "Comprar tudo" respeita o caixa', async ({ game, page }) => {
    await game.boot({ campaign: emptyCampaign });
    await game.continueToPrep();
    await page.getByRole('button', { name: 'Usar sugerida' }).click();
    const buyAll = page.getByRole('button', { name: /^Comprar tudo/ });
    await expect(buyAll).toBeEnabled();
    const label = await buyAll.textContent();
    const cost = Number(label!.replace(/[^\d,]/g, '').replace(',', '.'));
    expect(cost).toBeGreaterThan(0);
    await buyAll.click();
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText(`Caixa ${money(Math.round((300 - cost) * 100) / 100)}`);
  });

  test('RN-38: a compra não passa a capacidade de 120 unidades', async ({ game, page }) => {
    await game.boot({ campaign: { stock: { massa: STOCK_CAPACITY - 5 }, consumables: {} } });
    await game.continueToPrep();
    const row = page.locator('.pastel-de-feira li.item', { hasText: 'Carne' });
    await row.getByRole('button', { name: 'Aumentar' }).click();
    await row.getByRole('button', { name: 'Aumentar' }).click();
    await row.getByRole('button', { name: 'Comprar' }).click();
    await expect(page.getByRole('status')).toContainText('Sem espaço no estoque');
  });

  test('RN-53: nenhuma compra deixa o caixa negativo', async ({ game, page }) => {
    await game.boot({ campaign: { ...emptyCampaign, patch: (c) => ({ ...c, cash: 3 }) } });
    await game.continueToPrep();
    const row = page.locator('.pastel-de-feira li.item', { hasText: 'Massa' });
    await row.getByRole('button', { name: 'Aumentar' }).click();
    await row.getByRole('button', { name: 'Comprar' }).click();
    await expect(page.getByRole('status')).toContainText('Caixa insuficiente');
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Caixa R$ 3,00');
  });

  test('RN-10: preço sobe e desce em passos de R$ 0,50 e respeita 50%–250% da referência', async ({ game, page }) => {
    await game.boot({ campaign: emptyCampaign });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    const row = page.locator('.pastel-de-feira li.item', { hasText: 'Carne' });
    await expect(row.locator('.stepper span')).toHaveText('R$ 7,00');
    await row.getByRole('button', { name: 'Subir preço' }).click();
    await expect(row.locator('.stepper span')).toHaveText('R$ 7,50');
    for (let i = 0; i < 40; i++) await row.getByRole('button', { name: 'Baixar preço' }).click();
    await expect(row.locator('.stepper span')).toHaveText('R$ 4,00'); // 50% de R$ 8,00
    for (let i = 0; i < 40; i++) await row.getByRole('button', { name: 'Subir preço' }).click();
    await expect(row.locator('.stepper span')).toHaveText('R$ 20,00'); // 250% de R$ 8,00
  });

  test('RN-36a: abrir sem nenhum insumo mostra o aviso grave; "Voltar e comprar" fica no Preparo', async ({ game, page }) => {
    await game.boot({ campaign: emptyCampaign });
    await game.continueToPrep();
    await page.getByRole('button', { name: 'Abrir a feira' }).click();
    const dialog = page.getByRole('dialog', { name: 'Aviso antes de abrir a feira' });
    await expect(dialog).toContainText('Você não comprou nenhum insumo');
    await dialog.getByRole('button', { name: 'Voltar e comprar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.pastel-de-feira .prep')).toBeVisible();
  });

  test('RN-36a: com estoque completo a feira abre direto, sem diálogo', async ({ game, page }) => {
    await game.boot();
    await game.continueToPrep();
    await page.getByRole('button', { name: 'Abrir a feira' }).click();
    await expect(page.getByRole('dialog', { name: 'Aviso antes de abrir a feira' })).toHaveCount(0);
    await game.waitForDay();
  });

  test('RN-36a: sem copos o aviso lista a falta; "Abrir mesmo assim" abre o dia', async ({ game, page }) => {
    await game.boot({ campaign: { consumables: { saquinho: 50 } } });
    await game.continueToPrep();
    await page.getByRole('button', { name: 'Abrir a feira' }).click();
    const dialog = page.getByRole('dialog', { name: 'Aviso antes de abrir a feira' });
    await expect(dialog).toContainText('Sem copos');
    await dialog.getByRole('button', { name: 'Abrir mesmo assim' }).click();
    await game.waitForDay();
  });

  test('o estoque comprado no Preparo é o estoque do dia', async ({ game }) => {
    await game.startDay();
    const stock = await game.hook((pf) => Object.fromEntries(pf.sim.state.stock.map((l) => [l.ingredient, l.qty])));
    expect(stock).toMatchObject({ massa: 40, carne: 20, mucarela: 20, oregano: 10, cana: 20 });
    expect(await game.hook((pf) => pf.sim.state.consumables)).toMatchObject({ copo: 30, saquinho: 50 });
  });

  test('o cardápio e os preços do Preparo valem no dia', async ({ game, page }) => {
    await game.boot();
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    const row = page.locator('.pastel-de-feira li.item', { hasText: 'Carne' });
    await row.getByRole('button', { name: 'Subir preço' }).click();
    await game.openFair();
    const menu = await game.hook((pf) => pf.sim.state.config.menu.map((m) => [m.item, m.price]));
    expect(menu).toEqual(expect.arrayContaining([['carne', 7.5], ['queijo', 7], ['caldo-puro', 6]]));
  });
});
