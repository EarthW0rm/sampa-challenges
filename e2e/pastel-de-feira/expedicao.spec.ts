import { APP_PICKUP_DELAY, BAG_DECAY_FACTOR, DECAY_DELAY } from '../../src/games/pastel-de-feira/game/constants';
import { rollOrders } from '../../src/games/pastel-de-feira/game/campaign/actions/orders';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { currentQuality } from '../../src/games/pastel-de-feira/game/sim/quality';
import { buildCampaign } from './support/campaign';
import { expect, test, type GamePage } from './support/game';
import { assemble, fry, pack } from './support/flow';
import { hire } from './support/staff';

const withDelivery = (c: Campaign): Campaign => ({
  ...c, day: 5, calendar: 5, cash: 2000, deliveryOn: true,
  consumables: { ...c.consumables, embalagem: 10 },
  owned: { ...c.owned, delivery: true, extraM2: 3 },
});
const withWarmer = (c: Campaign): Campaign => {
  const d = withDelivery(c);
  return { ...d, owned: { ...d.owned, equip: [...d.owned.equip, 'estufa'] } };
};
// RN-102: quantidade de 10 a 40, retirada entre 9h e 13h30
const ORDER = { id: 'e2e-exp', dayId: 9101, item: 'carne', qty: 10, hour: 9.5, pay: 104, fine: 52 };
const withOrder = (on: boolean) => (c: Campaign): Campaign => ({
  ...c, day: 10, calendar: 10, cash: 3000, deliveryOn: on,
  consumables: { ...c.consumables, embalagem: 10 },
  owned: { ...c.owned, office: true, delivery: true, extraM2: 7 },
  orders: [ORDER],
});

/** Espera uma oferta e toca na faixa para aceitar (RN-91). Devolve a comanda APP criada. */
async function acceptNext(game: GamePage) {
  const before = (await game.hook((pf) => pf.tickets().filter((t) => t.kind === 'app').map((t) => t.id))).length;
  await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 90, undefined, 6);
  await game.tapAt(320, 10);
  await game.frames(1);
  const list = await game.hook((pf) => pf.tickets().filter((t) => t.kind === 'app'));
  expect(list.length, 'a oferta virou comanda').toBe(before + 1);
  return list[list.length - 1];
}

/** Monta e frita um pastel no ponto; devolve o id do pronto. */
async function readyPastry(game: GamePage, item: string): Promise<number> {
  await assemble(game, item);
  return (await fry(game, 6.5)).id;
}

/** RN-189 a RN-196: Expedição com balcão próprio, sacolas, encomenda e fila de motoboys (US-136). */
test.describe('Expedição', () => {
  test('RN-195: a faixa da oferta mostra os sabores pedidos e o tempo que falta', async ({ game }) => {
    await game.startDay({ campaign: { patch: withDelivery } });
    await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 90, undefined, 6);
    const o = await game.hook((pf) => pf.sim.state.offers[0]);
    expect(o.items.length).toBeGreaterThanOrEqual(2);
    expect(o.items.length).toBeLessThanOrEqual(4);
    // um selo por sabor pedido, entre "APP:" e "TOQUE": o centro de cada selo não é o verde da faixa
    const tw = (t: string) => (t.length * 4 - 1) * 2; // largura do texto da fonte pixel em k = 2
    const total = tw('APP:') + 6 + o.items.length * 16 + 4 + tw(`TOQUE ${Math.ceil(o.left)}S`);
    const x0 = Math.round(320 - total / 2) + tw('APP:') + 6;
    const centers = await game.page.evaluate((a) => {
      const cv = document.querySelector('.pastel-de-feira canvas') as HTMLCanvasElement;
      const ctx = cv.getContext('2d')!;
      return Array.from({ length: a.n }, (_, i) => [...ctx.getImageData((a.x0 + i * 16 + 7) * 2, 22, 1, 1).data.slice(0, 3)]);
    }, { n: o.items.length, x0 });
    for (const [r, g, b] of centers) expect(g > r + 30 && g > b, `selo no lugar (${r},${g},${b})`).toBe(false);
    await game.ev.action('Oferta do app com os selos dos sabores');
  });

  test('RN-91/RN-180: aceitar a oferta cria a comanda APP N no trilho da Expedição', async ({ game }) => {
    await game.startDay({ campaign: { patch: withDelivery } });
    const t = await acceptNext(game);
    expect(t.label).toMatch(/^APP \d+$/);
    expect(t.track).toBe('expedicao');
    expect(t.owner, 'o motoboy ainda não chegou').toBeNull();
    const pickup = await game.hook((pf, id) => pf.sim.state.tickets.find((x) => x.id === id)!.pickupAt! - pf.sim.state.tick / 60, t.id);
    expect(pickup).toBeCloseTo(APP_PICKUP_DELAY, 0);
  });

  test('RN-189: na sacola a nota cai a 1/4 do ritmo normal até a retirada', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withDelivery } });
    const t = await acceptNext(game);
    const id = await readyPastry(game, t.slots[0].item);
    await pack(game, id, t.label);
    await game.advance(20);
    const r = await game.hook((pf, tid) => {
      const x = pf.sim.state.tickets.find((k) => k.id === tid)!.slots.find((l) => l.filled)!.filled as { id: number; item: string; quality: number; readyAt: number; bagged?: boolean };
      return { x, now: pf.sim.state.tick / 60 };
    }, t.id);
    expect(r.x.bagged).toBe(true);
    const waited = r.now - r.x.readyAt;
    expect(currentQuality(r.x, r.now)).toBeCloseTo(r.x.quality - Math.max(0, waited - DECAY_DELAY) * BAG_DECAY_FACTOR, 5);
  });

  test('RN-27: o pastel posto na sacola sai da estufa e libera a vaga', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withWarmer } });
    const t = await acceptNext(game);
    const id = await readyPastry(game, t.slots[0].item);
    expect(await game.hook((pf, rid) => !!pf.sim.state.ready.find((x) => x.id === rid)?.warmed, id), 'o pastel tirado do óleo vai para a estufa').toBe(true);
    await pack(game, id, t.label);
    expect(await game.hook((pf) => pf.sim.state.ready.filter((x) => x.warmed).length)).toBe(0);
  });

  test('RN-193/RN-191/RN-194: o motoboy chega 35 s depois do aceite e entra na fila, de capacete', async ({ game }) => {
    await game.startDay({ campaign: { patch: withDelivery } });
    const t = await acceptNext(game);
    await game.advance(APP_PICKUP_DELAY - 1);
    expect(await game.filaExpedicao()).toEqual([]);
    await game.advance(1.5);
    const q = await game.filaExpedicao();
    expect(q.map((e) => ({ who: e.who, label: e.label }))).toEqual([{ who: 'motoboy', label: t.label }]);
    // sprite próprio (RN-194): o capacete vermelho aparece acima do motoboy
    const red = await game.page.evaluate((p) => {
      const cv = document.querySelector('.pastel-de-feira canvas') as HTMLCanvasElement;
      const d = cv.getContext('2d')!.getImageData((p.x - 10) * 2, (p.y - 40) * 2, 40, 28).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] < 110 && d[i + 2] < 100) n++;
      return n;
    }, q[0]);
    expect(red, 'pixels do capacete vermelho').toBeGreaterThan(10);
    await game.ev.action('Motoboy na fila da Expedição');
  });

  test('RN-190/RN-191: sem atendente a fila cresce; com o pasteleiro no balcão da Expedição, o da frente leva a sacola completa', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withDelivery } });
    const t = await acceptNext(game);
    for (const item of t.slots.map((s) => s.item)) await pack(game, await readyPastry(game, item), t.label);
    await game.goTo('bancada');
    await game.advanceUntil((pf) => pf.sim.state.dispatchQueue.length > 0, APP_PICKUP_DELAY + 5, undefined, 6);
    await game.advance(3);
    expect(await game.hook((pf) => pf.sim.state.stats.appPicked), 'sem atendente ninguém é atendido').toBe(0);
    await game.atenderExpedicao(15);
    const r = await game.hook((pf) => ({ picked: pf.sim.state.stats.appPicked, q: pf.sim.state.dispatchQueue.length }));
    expect(r).toEqual({ picked: 1, q: 0 });
  });

  test('RN-104/RN-180: a encomenda vira a comanda E às 07h, com o cliente na fila da Expedição no horário', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withOrder(false) } });
    const t = (await game.hook((pf) => pf.tickets().find((x) => x.kind === 'encomenda')))!;
    expect(t.label).toMatch(/^E\d+$/);
    expect(t.slots.length).toBe(ORDER.qty);
    const entered = await game.hook((pf, id) => pf.sim.state.tickets.find((x) => x.id === id)!.enteredAt, t.id);
    expect(entered, 'entra às 07h').toBe(0);
    await game.advance(((ORDER.hour - 7) * 240) / 7 + 0.5);
    expect((await game.filaExpedicao()).map((e) => e.who)).toEqual(['encomenda']);
  });

  test('RN-102: com o delivery desligado no dia, a Expedição continua atendendo a encomenda e não há ofertas do app', async ({ game }) => {
    await game.startDay({ campaign: { patch: withOrder(false) } });
    expect(await game.hook((pf) => pf.env.layout.zones.map((z) => z.id))).toContain('expedicao');
    await game.advance(60);
    expect(await game.hook((pf) => pf.sim.state.offers.length)).toBe(0);
    expect(await game.hook((pf) => pf.tickets().some((t) => t.kind === 'encomenda'))).toBe(true);
  });

  test('RN-102: encomenda exige escritório e área de delivery', async ({ game, page }) => {
    const semDelivery = (c: Campaign): Campaign => ({ ...c, day: 10, calendar: 10, cash: 3000, owned: { ...c.owned, office: true, extraM2: 4 } });
    await game.boot({ campaign: { patch: semDelivery } });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Escritório' }).click();
    await expect(page.locator('.pastel-de-feira')).toContainText('Encomendas exigem também a área de delivery');
    await expect(page.getByRole('button', { name: 'Aceitar' })).toHaveCount(0);
  });

  test('RN-95: o aceite automático só liga com alguém fixo na Expedição', async ({ game, page }) => {
    await game.boot({ campaign: { patch: withDelivery } });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    const box = page.locator('.pastel-de-feira label.check', { hasText: 'Aceite automático' }).getByRole('checkbox');
    await expect(box).toBeDisabled();
    await hire(game, 'Geral', 'Expedição');
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    await expect(box).toBeEnabled();
  });

  test('RN-95: com o aceite automático, a oferta sem insumo para todos os itens não é aceita', async ({ game, page }) => {
    test.setTimeout(240_000);
    await game.boot({ campaign: { patch: withDelivery, stock: { massa: 1, carne: 1, mucarela: 1, oregano: 1, cana: 5 } } });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Expedição');
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    await page.locator('.pastel-de-feira label.check', { hasText: 'Aceite automático' }).getByRole('checkbox').check();
    await game.openFair();
    await game.advanceUntil((pf) => pf.sim.state.offers.length > 0, 90, undefined, 6);
    await game.advance(11);
    expect(await game.hook((pf) => ({ accepted: pf.sim.state.acceptedToday, app: pf.tickets().filter((t) => t.kind === 'app').length }))).toEqual({ accepted: 0, app: 0 });
  });

  test('RN-102: com o aceite automático, a encomenda coberta pelo estoque é aceita ao abrir a feira', async ({ game, page }) => {
    test.setTimeout(240_000);
    // calendário com oferta de encomenda para esta semente
    let cal = 10;
    for (; cal < 60; cal++) {
      const c = buildCampaign({ patch: (x) => ({ ...withOrder(true)(x), orders: [], calendar: cal }) });
      if (rollOrders(c).some((o) => o.item === 'carne' && o.qty <= 20)) break;
    }
    const patch = (x: Campaign): Campaign => ({ ...withOrder(true)(x), orders: [], calendar: cal });
    await game.boot({ campaign: { patch } }); // estoque padrão: 40 massas e 20 carnes cobrem a encomenda de até 20 de carne
    await game.continueToPrep();
    await hire(game, 'Geral', 'Expedição');
    await page.getByRole('tab', { name: 'Cardápio' }).click();
    await page.locator('.pastel-de-feira label.check', { hasText: 'Aceite automático' }).getByRole('checkbox').check();
    await game.openFair();
    expect(await game.hook((pf) => pf.tickets().filter((t) => t.kind === 'encomenda').length)).toBeGreaterThan(0);
  });

  test('RN-196: barraca cheia com Mesas 200, Expedição 200, Escritório 100 e Descanso 100 de largura', async ({ game }) => {
    const full = (c: Campaign): Campaign => ({ ...c, day: 12, calendar: 12, cash: 5000, owned: { ...c.owned, delivery: true, office: true, tables: 2, rest: 2, extraM2: 18 } });
    await game.startDay({ campaign: { patch: full } });
    const z = await game.hook((pf) => Object.fromEntries(pf.env.layout.zones.map((x) => [x.id, { x: x.x, w: x.w }])));
    expect([z.mesas.w, z.expedicao.w, z.escritorio.w, z.descanso.w]).toEqual([200, 200, 100, 100]);
    expect(z.descanso.x + z.descanso.w).toBeLessThanOrEqual(640);
    await game.ev.action('Faixa inferior com as quatro zonas');
  });

  test('Save v2 com encomenda e sem área de delivery abre sem a encomenda e com aviso', async ({ game, page }) => {
    const c = buildCampaign({ patch: (x) => ({ ...x, day: 10, calendar: 10, cash: 3000, owned: { ...x.owned, office: true, extraM2: 4 }, orders: [ORDER] }) });
    await game.boot({ rawSave: JSON.stringify({ version: 2, phase: 'preparo', campaign: c }) });
    await expect(page.locator('.pastel-de-feira')).toContainText('A encomenda aceita foi descartada sem multa');
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Escritório' }).click();
    await expect(page.locator('.pastel-de-feira')).not.toContainText('Aceita:');
  });
});
