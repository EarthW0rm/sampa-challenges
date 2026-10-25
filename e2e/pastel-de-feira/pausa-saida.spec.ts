import { SAVE_KEY } from './support/campaign';
import { expect, test } from './support/game';

/** JA-06: sair no meio do dia e voltar recomeça o Dia de Feira com novo sorteio. */
test.describe('Sair no meio do dia', () => {
  test('Pausa → Sair volta ao hub; Continuar recomeça o dia às 07:00 com as compras feitas', async ({ game, page }) => {
    await game.startDay();
    await game.waitCustomer();
    const firstOrder = await game.hook((pf) => ({ arrived: pf.sim.state.customers[0].arrivedAt, items: pf.sim.state.customers[0].lines.map((l) => l.item) }));
    await game.advance(30);
    await page.getByRole('button', { name: 'Pausar' }).click();
    await game.frames(7); // o HUD (e o overlay de pausa) atualiza a cada 100 ms
    await page.getByRole('dialog', { name: 'Jogo pausado' }).getByRole('button', { name: 'Sair' }).click();
    await expect(page.getByRole('heading', { name: 'SAMPA CHALLENGES' })).toBeVisible();

    await page.goto('./#/jogos/pastel-de-feira');
    await page.getByRole('button', { name: 'Continuar (dia 1)' }).click();
    await game.waitForDay();
    await game.frames(7);
    await expect(game.clock).toHaveText('07:00');
    const stock = await game.hook((pf) => Object.fromEntries(pf.sim.state.stock.map((l) => [l.ingredient, l.qty])));
    expect(stock).toMatchObject({ massa: 40, carne: 20 });
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(saved.campaign.resumes).toBe(1);
    // novo sorteio (PA-13): a semente muda com a retomada
    await game.waitCustomer();
    const again = await game.hook((pf) => ({ arrived: pf.sim.state.customers[0].arrivedAt, items: pf.sim.state.customers[0].lines.map((l) => l.item) }));
    expect(again).not.toEqual(firstOrder);
  });

  test('o caixa não muda ao sair no meio do dia (nada é cobrado nem pago)', async ({ game, page }) => {
    await game.startDay();
    const cash0 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).campaign.cash, SAVE_KEY);
    await game.advance(20);
    await page.getByRole('button', { name: 'Pausar' }).click();
    await game.frames(7); // o HUD (e o overlay de pausa) atualiza a cada 100 ms
    await page.getByRole('dialog', { name: 'Jogo pausado' }).getByRole('button', { name: 'Sair' }).click();
    await page.goto('./#/jogos/pastel-de-feira');
    await page.getByRole('button', { name: /^Continuar/ }).click();
    await game.waitForDay();
    const cash1 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).campaign.cash, SAVE_KEY);
    expect(cash1).toBe(cash0);
  });

  test('voltar ao hub pela barra no meio do dia desmonta o jogo sem erros e sem laço vivo', async ({ game, page }) => {
    await game.startDay();
    await game.advance(5);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.getByRole('heading', { name: 'SAMPA CHALLENGES' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pf?: unknown }).__pf ?? null)).toBeNull();
    await game.frames(60); // nenhum quadro do dia deve rodar depois da saída
  });
});
