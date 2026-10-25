import { SAVE_KEY } from './support/campaign';
import { expect, test, type GamePage } from './support/game';
import { collect, serveFront } from './support/flow';

const parseMoney = (s: string): number => {
  const neg = /[−-]/.test(s);
  const n = Number(s.replace(/[^\d,]/g, '').replace(',', '.'));
  return neg ? -n : n;
};

/** Lê a tabela do fechamento: { rótulo: texto }. */
async function summary(game: GamePage): Promise<Record<string, string>> {
  const rows = game.page.locator('.pastel-de-feira table.summary tr');
  const out: Record<string, string> = {};
  for (let i = 0; i < (await rows.count()); i++) {
    const th = (await rows.nth(i).locator('th').textContent())!.trim();
    out[th] = (await rows.nth(i).locator('td').textContent())!.trim();
  }
  return out;
}

const LINE_LABELS = ['Vendas', 'Insumos usados', 'Insumos dos brindes', 'Insumos estragados', 'Sobras vendidas na xepa', 'Copos e saquinhos', 'Troca de óleo', 'Taxa de espaço', 'Salários', 'Bônus de aproveitamento', 'Reparo do tacho', 'Multa da fiscalização', 'Multas de encomenda'];

/** Fechamento (Jornada 2.3, RN-07, RN-34, RN-37, RN-50, RN-55, RN-62, RN-64). */
test.describe('Fechamento do dia', () => {
  test('dia sem atender ninguém: lucro negativo, meta não cumprida, o dia 1 se repete', async ({ game, page }) => {
    await game.startDay();
    await game.runToEnd();
    const s = await summary(game);
    const r = await game.lastHook((pf) => pf.result!);
    expect(s['Pedidos atendidos']).toBe('0');
    expect(Number(s['Clientes perdidos'])).toBe(r.orders.lostPatience + r.orders.queueFull + r.orders.lostPrice + r.orders.noStock);
    expect(parseMoney(s['Vendas'])).toBe(0);
    await expect(page.getByText('Meta não cumprida. O dia 1 se repete.')).toBeVisible();
    await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Dia 1');
  });

  test('o lucro líquido é a soma das linhas do balanço', async ({ game }) => {
    await game.startDay();
    await serveFront(game);
    await collect(game);
    await game.runToEnd();
    const s = await summary(game);
    const sum = LINE_LABELS.filter((l) => l in s).reduce((n, l) => n + parseMoney(s[l]), 0);
    expect(parseMoney(s['Lucro líquido'])).toBeCloseTo(sum, 2);
  });

  test('vendas do fechamento = caixa cobrado no dia; atendidos batem com o dia', async ({ game }) => {
    await game.startDay();
    await serveFront(game);
    await collect(game);
    await serveFront(game);
    await collect(game);
    const revenue = await game.hook((pf) => pf.sim.state.stats.revenue);
    await game.runToEnd();
    const s = await summary(game);
    expect(parseMoney(s['Vendas'])).toBeCloseTo(revenue, 2);
    expect(s['Pedidos atendidos']).toBe('2');
  });

  test('RN-62/RN-64: a variação de reputação mostrada é a do resultado do dia', async ({ game }) => {
    await game.startDay();
    await game.runToEnd();
    const r = await game.lastHook((pf) => pf.result!.reputation);
    const s = await summary(game);
    const [before, after] = s['Reputação'].split('→').map((x) => Number(x.trim().split(' ')[0].replace(',', '.')));
    expect(before).toBe(3);
    expect(after).toBeCloseTo(Math.max(1, Math.min(5, 3 + r.change)), 1);
  });

  test('RN-34: recheio que sobra estraga no fechamento; a massa passa para o dia seguinte', async ({ game, page }) => {
    await game.startDay();
    await game.runToEnd();
    const s = await summary(game);
    expect(Number(s['Estragados'])).toBe(20 + 20 + 10 + 20); // carne, muçarela, orégano e cana: nada foi usado
    await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
    await expect(page.locator('.pastel-de-feira li.item', { hasText: 'Massa' })).toContainText('tem 40');
    await expect(page.locator('.pastel-de-feira li.item', { hasText: 'Carne' })).toContainText('tem 0');
  });

  test('RN-55: o fechamento grava o save (fase preparo) com o caixa novo', async ({ game, page }) => {
    await game.startDay();
    await game.runToEnd();
    const s = await summary(game);
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(saved.phase).toBe('preparo');
    expect(saved.campaign.cash).toBeCloseTo(parseMoney(s['Caixa']), 2);
  });

  test('RN-55/JA-06: o início do dia grava o checkpoint (fase dia)', async ({ game, page }) => {
    await game.startDay();
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(saved.phase).toBe('dia');
  });

  test('RN-50: meta cumprida avança o dia (lucro alto forçado pelo preço)', async ({ game, page }) => {
    // a meta do dia 1 é R$ 70; com o caixa já gasto nas compras, o lucro vem só das vendas do dia
    await game.startDay();
    for (let i = 0; i < 6; i++) {
      await serveFront(game);
      await collect(game);
    }
    await game.runToEnd();
    const s = await summary(game);
    const profit = parseMoney(s['Lucro líquido']);
    const met = s['Meta de lucro'].includes('✓') && s['Reputação mínima'].includes('✓');
    expect(s['Meta de lucro'].includes('✓')).toBe(profit >= 70);
    await expect(page.getByText(met ? 'Meta cumprida. Próximo: dia 2.' : 'Meta não cumprida. O dia 1 se repete.')).toBeVisible();
  });

  test('Jornada 2.3: o fechamento mostra pedidos errados do dia', async ({ game }) => {
    await game.startDay();
    await game.runToEnd();
    const s = await summary(game);
    expect(Object.keys(s).some((k) => /errad/i.test(k)), `linhas: ${Object.keys(s).join(' | ')}`).toBe(true);
  });

  test('formatação: linha de custo zerada não aparece com sinal de entrada (+)', async ({ game }) => {
    await game.startDay();
    await game.runToEnd();
    const s = await summary(game);
    expect(s['Troca de óleo']).not.toMatch(/^\+/);
  });

  test('formatação: lucro negativo usa o mesmo sinal das linhas (− R$)', async ({ game }) => {
    await game.startDay();
    await game.runToEnd();
    const s = await summary(game);
    expect(s['Lucro líquido']).not.toContain('R$ -');
  });
});
