import { expect, test, type GamePage } from './support/game';
import { collect, serveFront } from './support/flow';

const parseMoney = (s: string): number => {
  const neg = /[−-]/.test(s);
  const n = Number(s.replace(/[^\d,]/g, '').replace(',', '.'));
  return neg ? -n : n;
};

async function summary(game: GamePage): Promise<Record<string, string>> {
  const rows = game.page.locator('.pastel-de-feira table.summary tr');
  const out: Record<string, string> = {};
  for (let i = 0; i < (await rows.count()); i++) {
    out[(await rows.nth(i).locator('th').textContent())!.trim()] = (await rows.nth(i).locator('td').textContent())!.trim();
  }
  return out;
}

/** Linhas do balanço que já foram pagas no Preparo (não mexem no caixa no fechamento). */
const PREPAID = ['Insumos usados', 'Insumos dos brindes', 'Insumos estragados', 'Copos e saquinhos'];
const CASH_LINES = ['Vendas', 'Sobras vendidas na xepa', 'Troca de óleo', 'Taxa de espaço', 'Salários', 'Bônus de aproveitamento', 'Reparo do tacho', 'Multa da fiscalização', 'Multas de encomenda'];

/** Jornada principal inteira: um dia jogado só por toques, do Preparo ao Fechamento, e a conta do caixa fecha. */
test('dia inteiro atendendo pela tela: fechamento consistente com o que aconteceu no dia', async ({ game, page }) => {
  test.setTimeout(900_000);
  await game.boot();
  const cash0 = await page.evaluate(() => JSON.parse(localStorage.getItem('pastel-de-feira:campanha')!).campaign.cash as number);
  await game.continueToPrep();
  await game.openFair();

  let served = 0;
  for (let guard = 0; guard < 60; guard++) {
    const left = await game.hook((pf) => 240 - pf.sim.state.tick / 60);
    if (left < 25) break;
    try {
      await serveFront(game);
      served++;
    } catch (e) {
      // o cliente desistiu no meio do atendimento ou o dia acabou: segue para o próximo
      if (await game.page.evaluate(() => !(window as unknown as { __pf?: unknown }).__pf)) break;
      void e;
    }
    if (await game.hook((pf) => pf.sim.state.coins.length > 0)) await collect(game);
  }
  if (await game.page.evaluate(() => !!(window as unknown as { __pf?: unknown }).__pf)) {
    if (await game.hook((pf) => pf.sim.state.coins.length > 0)) await collect(game);
  }
  const live = await game.lastHook((pf) => ({ revenue: pf.sim.state.stats.revenue, served: pf.sim.state.stats.served }));
  await game.runToEnd();
  const r = await game.lastHook((pf) => pf.result!);
  const s = await summary(game);

  expect(served, 'atendimentos completos pela tela').toBeGreaterThan(3);
  expect(Number(s['Pedidos atendidos'])).toBe(r.orders.served);
  expect(r.orders.served).toBeGreaterThanOrEqual(live.served);
  expect(parseMoney(s['Vendas'])).toBeCloseTo(r.revenue.total, 2);
  expect(r.revenue.total).toBeCloseTo(live.revenue, 2);
  expect(Number(s['Clientes perdidos'])).toBe(r.orders.lostPatience + r.orders.queueFull + r.orders.lostPrice + r.orders.noStock);

  // o caixa final = caixa do Preparo + linhas que entram/saem no fechamento
  const delta = CASH_LINES.filter((l) => l in s).reduce((n, l) => n + parseMoney(s[l]), 0);
  expect(parseMoney(s['Caixa'])).toBeCloseTo(cash0 + delta, 2);
  // e o lucro = todas as linhas, inclusive as pagas no Preparo
  const all = [...CASH_LINES, ...PREPAID].filter((l) => l in s).reduce((n, l) => n + parseMoney(s[l]), 0);
  expect(parseMoney(s['Lucro líquido'])).toBeCloseTo(all, 2);

  // reputação: antes → depois = 3,0 + variação do dia (limitada a ±1)
  const after = Number(s['Reputação'].split('→')[1].trim().split(' ')[0].replace(',', '.'));
  expect(after).toBeCloseTo(Math.max(1, Math.min(5, 3 + r.reputation.change)), 1);

  // o próximo Preparo carrega o caixa do fechamento
  await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
  await expect(page.locator('.pastel-de-feira .prep-head')).toContainText(`Caixa ${s['Caixa']}`);
});
