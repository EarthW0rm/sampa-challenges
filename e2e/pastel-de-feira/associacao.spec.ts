import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test } from './support/game';

const DAY3 = (c: Campaign): Campaign => ({ ...c, day: 3, calendar: 3, cash: 1000 });

/** RN-135–137: desafios da Associação da Feira. */
test.describe('Associação da Feira', () => {
  test('RN-135: no dia 3 a aba mostra até 2 desafios; aceitar move para "Em andamento"', async ({ game, page }) => {
    await game.boot({ campaign: { patch: DAY3 } });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Associação' }).click();
    const tab = page.getByRole('region', { name: 'Associação' });
    const offered = tab.getByRole('button', { name: 'Aceitar' });
    const n = await offered.count();
    expect(n).toBeLessThanOrEqual(2);
    test.skip(n === 0, 'nenhum desafio sorteado para esta semente');
    const name = await tab.locator('li.item').filter({ has: page.getByRole('button', { name: 'Aceitar' }) }).first().locator('strong').textContent();
    await offered.first().click();
    await expect(tab.locator('li.item', { hasText: name! }).first()).toContainText('Prêmio');
    await expect(tab.getByText('Nenhum desafio aceito.')).toHaveCount(0);
  });

  test('RN-135/RN-136: "Passar numa fiscalização" aceito e cumprido paga R$ 200 no fechamento', async ({ game, page }) => {
    await game.startDay({
      campaign: { patch: (c) => ({ ...DAY3(c), challenges: [{ id: 'fiscalizacao', acceptedOn: 3, deadline: 10, progress: 0 }] }) },
      storage: { 'pastel-de-feira:forcar': 'fiscal' },
    });
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary tr', { hasText: 'Prêmio: Passar numa fiscalização' })).toContainText('R$ 200,00');
  });

  test('RN-135: desafio vencido some sem penalidade', async ({ game, page }) => {
    await game.startDay({ campaign: { patch: (c) => ({ ...DAY3(c), challenges: [{ id: 'caldos-40', acceptedOn: 1, deadline: 3, progress: 0 }] }) } });
    await game.runToEnd();
    const lines = await page.locator('.pastel-de-feira table.summary th').allTextContents();
    expect(lines.some((l) => /desafio|penal/i.test(l))).toBe(false);
    await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
    await page.getByRole('tab', { name: 'Associação' }).click();
    await expect(page.getByRole('region', { name: 'Associação' }).getByText('Servir 40 caldos num dia')).toHaveCount(0);
  });
});
