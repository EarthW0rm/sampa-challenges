import { DECAY_DELAY, OIL_CHANGE_COST_COTTON, OIL_DIRT_PER_PASTRY_COTTON, QUALITY_PONTO } from '../../src/games/pastel-de-feira/game/constants';
import { MILL_MOTOR_SECONDS, QUALITY_BONUS, THERMOSTAT, WARMER } from '../../src/games/pastel-de-feira/game/data/equipment';
import { expect, test, type GamePage } from './support/game';
import { assemble, fry, fryTimes, mill, tapBasket } from './support/flow';

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const RICH = { patch: (c: import('../../src/games/pastel-de-feira/game/campaign/types').Campaign) => ({ ...c, cash: 5000 }) };

/** Compra uma melhoria pela aba Melhorias e confere o débito no caixa. */
async function buy(game: GamePage, name: string | RegExp, price: number): Promise<void> {
  const page = game.page;
  await page.getByRole('tab', { name: 'Melhorias' }).click();
  const head = page.locator('.pastel-de-feira .prep-head');
  const before = Number((await head.locator('div').nth(1).textContent())!.replace(/[^\d,]/g, '').replace(',', '.'));
  const row = page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong', { hasText: name }) }).first();
  await row.getByRole('button', { name: money(price) }).click();
  await expect(head).toContainText(`Caixa ${money(Math.round((before - price) * 100) / 100)}`);
}

/** RN-24, RN-27, RN-42, RN-46, RN-70–73, RN-80, RN-117: compras no Preparo e o efeito no dia. */
test.describe('Melhorias compradas e o efeito no Dia de Feira', () => {
  test('RN-70: a barraca inicial tem balcão, bancada, 1 tacho pequeno (2 cestos) e moenda', async ({ game }) => {
    await game.startDay();
    const z = await game.hook((pf) => pf.env.layout.zones.map((x) => x.id));
    expect(z).toEqual(['fila', 'balcao', 'bancada', 'tacho1', 'moenda']);
    expect(await game.hook((pf) => pf.sim.state.tachos[0].baskets.length)).toBe(2);
  });

  test('RN-73: cesto avulso (R$ 200) — dois cestos levam o tacho 1 de 2 para 4', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Cesto extra no tacho 1', 200);
    await buy(game, 'Cesto extra no tacho 1', 200);
    await expect(game.page.locator('.pastel-de-feira li.item strong', { hasText: 'Cesto extra' })).toHaveCount(0); // um tacho só, já com 4
    await game.openFair();
    await game.goTo('tacho1');
    expect((await game.controls()).filter((c) => c.label.startsWith('CESTO')).length).toBe(4);
  });

  test('RN-71/RN-72/RN-73: Tacho extra exige 2 m² e cria a zona do tacho 2', async ({ game, page }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Melhorias' }).click();
    const row = page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong', { hasText: 'Tacho extra' }) });
    await expect(row).toContainText('Sem m² livres');
    await buy(game, 'Mais 1 m²', 120);
    await buy(game, 'Mais 1 m²', 120);
    await buy(game, 'Tacho extra', 350);
    await game.openFair();
    expect(await game.hook((pf) => pf.env.layout.zones.map((x) => x.id))).toContain('tacho2');
    await game.goTo('tacho2');
    await assemble(game, 'carne');
    await game.goTo('tacho2');
    await game.tapControl('CESTO 1');
    expect(await game.hook((pf) => pf.sim.state.tachos[1].baskets[0].frying?.item)).toBe('carne');
  });

  test('RN-73: Termostato alarga o ponto em 50% e adia a queima em 3 s', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Termostato no tacho 1', 350);
    await game.openFair();
    const t = fryTimes('carne');
    const end = t.ponto[0] + (t.ponto[1] - t.ponto[0]) * THERMOSTAT.pontoMult; // 9,5 s
    await assemble(game, 'carne');
    expect((await fry(game, end - 0.2)).quality).toBe(QUALITY_PONTO);
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    await game.frames(Math.round((t.burnAt + 1) * 60)); // 11 s: sem termostato já teria queimado
    expect(await game.hook((pf) => pf.sim.state.tachos[0].baskets[0].frying?.burned)).toBe(false);
    await game.frames(Math.round((THERMOSTAT.burnExtra - 1 + 0.2) * 60));
    expect(await game.hook((pf) => pf.sim.state.tachos[0].baskets[0].frying?.burned)).toBe(true);
  });

  test('RN-73: Alarme pisca o cesto quando entra no ponto', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Alarme no tacho 1', 60);
    await game.openFair();
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    await game.frames(Math.round(5.2 * 60));
    expect(await game.hook((pf) => pf.sim.state.tachos[0].baskets[0].frying?.pontoAlerted)).toBe(true);
  });

  test('RN-24: Escorredor soma +10 na nota', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Escorredor profissional', 250);
    await game.openFair();
    await assemble(game, 'carne');
    expect((await fry(game, 6.5)).quality).toBe(QUALITY_PONTO + QUALITY_BONUS.drainer);
  });

  test('RN-24/RN-46: Óleo de algodão: nota +10, suja 3% por pastel e a troca custa R$ 45', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Óleo de algodão', 300);
    await game.openFair();
    await assemble(game, 'carne');
    const p = await fry(game, 6.5);
    expect(p.quality).toBe(QUALITY_PONTO + QUALITY_BONUS.cotton);
    expect(await game.hook((pf) => pf.sim.state.tachos[0].dirt)).toBe(OIL_DIRT_PER_PASTRY_COTTON);
    await game.goTo('tacho1');
    await game.holdControl('TROCAR OLEO', 8.05);
    expect(await game.hook((pf) => pf.sim.state.stats.oilCost)).toBe(OIL_CHANGE_COST_COTTON);
  });

  test('RN-42: Moenda motorizada faz o caldo em 2,5 s', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Moenda motorizada', 500);
    await game.openFair();
    await mill(game, MILL_MOTOR_SECONDS);
    expect(await game.hook((pf) => pf.sim.state.cups.length)).toBe(1);
  });

  test('RN-27: a estufa fica em cima do balcão e o pastel frito vai direto para ela, com a nota congelada por 60 s', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Estufa de vidro', 300);
    await game.openFair();
    expect(await game.hook((pf) => pf.env.layout.zones.map((x) => x.id)), 'não é estação: não tem zona').not.toContain('estufa');
    await assemble(game, 'carne');
    const a = await fry(game, 6.5);
    expect(await game.hook((pf, id) => pf.sim.state.ready.find((r) => r.id === id)?.warmed, a.id), 'saiu do óleo direto para a estufa').toBe(true);
    await game.advance(DECAY_DELAY + 30);
    const q = await game.hook((pf, id) => {
      const st = pf.sim.state;
      const r = st.ready.find((x) => x.id === id)!;
      return Math.round(r.quality - Math.max(0, st.tick / 60 - r.readyAt - 60));
    }, a.id);
    expect(q, 'na estufa: congelada').toBe(QUALITY_PONTO);
    // no balcão: o pastel da estufa aparece marcado com E e pode ser entregue dali
    await game.goTo('balcao');
    const subs = (await game.controls()).map((c) => c.sub);
    expect(subs).toContain(`E ${QUALITY_PONTO}`);
  });

  test('RN-27: com a estufa cheia (6), o sétimo pastel fica no balcão', async ({ game }) => {
    await game.boot({ campaign: { ...RICH, stock: { massa: 30, carne: 20, mucarela: 20, cana: 10 } } });
    await game.continueToPrep();
    await buy(game, 'Estufa de vidro', 300);
    await game.openFair();
    for (let i = 0; i < WARMER.capacity + 1; i++) {
      await assemble(game, 'carne');
      await fry(game, 6.5);
    }
    const s = await game.hook((pf) => ({ warmed: pf.sim.state.ready.filter((r) => r.warmed).length, out: pf.sim.state.ready.filter((r) => !r.warmed).length }));
    expect(s).toEqual({ warmed: WARMER.capacity, out: 1 });
  });

  test('RN-80/RN-72: Mesa exige 2 m² e cria a zona de mesas', async ({ game }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Mais 1 m²', 120);
    await buy(game, 'Mais 1 m²', 120);
    await buy(game, 'Mesa 1', 150);
    await game.openFair();
    expect(await game.hook((pf) => pf.env.layout.zones.map((x) => x.id))).toContain('mesas');
    expect(await game.hook((pf) => pf.sim.state.tables.length)).toBe(1);
    await game.goTo('mesas');
    expect((await game.controls()).map((c) => c.label)).toEqual(expect.arrayContaining(['ANOTAR', 'LIMPAR']));
  });

  test('RN-71: m² extra cobra R$ 8 por dia no fechamento', async ({ game, page }) => {
    await game.boot({ campaign: RICH });
    await game.continueToPrep();
    await buy(game, 'Mais 1 m²', 120);
    await game.openFair();
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary tr', { hasText: 'Taxa de espaço' })).toContainText('R$ 8,00');
  });
});
