import { RAIL_VISIBLE } from '../../src/games/pastel-de-feira/game/constants';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test, type GamePage } from './support/game';
import { assemble, fry, fryTimes, isDrink, serveCustomer, takeOrder } from './support/flow';
import { hire } from './support/staff';

const withTables = (c: Campaign): Campaign => ({ ...c, cash: 2000, owned: { ...c.owned, tables: 2, extraM2: 4 } });
const DAY2 = { patch: (c: Campaign) => ({ ...c, day: 2, calendar: 2, cash: 1000 }) };

/** Itens ainda livres da comanda do cliente. */
const openItems = (game: GamePage, owner: number) =>
  game.hook((pf, id) => pf.tickets().find((t) => t.owner === id)?.slots.filter((s) => !s.filled).map((s) => s.item) ?? [], owner);

/** Monta e frita no ponto um pastel do sabor; devolve o id do pronto. */
async function readyPastry(game: GamePage, item: string): Promise<number> {
  await assemble(game, item);
  const t = fryTimes(item);
  return (await fry(game, (t.ponto[0] + t.ponto[1]) / 2)).id;
}

/** No balcão, escolhe no painel o pastel pronto pelo id. */
async function selectReady(game: GamePage, id: number): Promise<void> {
  await game.goTo('balcao');
  const idx = await game.hook((pf, rid) => {
    const ctl = pf.controls();
    const base = ctl.findIndex((c) => c.label === 'VASSOURA') + 1;
    return base + pf.sim.state.ready.slice(0, 7).findIndex((x) => x.id === rid);
  }, id);
  const ctl = (await game.controls())[idx];
  await game.ev.quiet(async () => {
    await game.tapAt(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2);
    await game.frames(1);
  });
  await game.ev.action(`Selecionar o pastel #${id} no painel do balcão`);
}

/** RN-180 a RN-188: comandas no trilho do balcão (US-135). */
test.describe('Comandas no balcão', () => {
  test('RN-180: anotar cria a comanda #N com um selo por item do pedido', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.place === 'fila')!;
      return { id: x.id, items: x.lines.map((l) => l.item) };
    });
    expect(await game.comanda({ owner: c.id }), 'antes de anotar não há comanda').toBeNull();
    await takeOrder(game);
    const t = await game.comanda({ owner: c.id });
    expect(t?.label).toBe('#1');
    expect(t?.track).toBe('balcao');
    expect(t?.slots.map((s) => s.item)).toEqual(c.items);
    expect(t?.rect, 'a comanda aparece no trilho').not.toBeNull();
  });

  test('RN-180/RN-83: o pedido de um grupo de mesa vira a comanda M', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withTables } });
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => !!c.group && c.place === 'fila'), 240, undefined, 30);
    const id = await game.hook((pf) => pf.sim.state.customers.find((x) => !!x.group && x.place === 'fila')!.id);
    await game.goTo('balcao');
    for (let i = 0; i < 8 && !(await game.comanda({ owner: id })); i++) await game.tapControl('ANOTAR');
    expect((await game.comanda({ owner: id }))?.label).toMatch(/^M\d+$/);
  });

  test(`RN-181: o trilho mostra as comandas da mais antiga para a mais nova, no máximo ${RAIL_VISIBLE}, e o resto no +N`, async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay();
    await game.advanceUntil((pf) => pf.queue().length >= 4, 120, undefined, 6);
    await game.goTo('balcao');
    for (let i = 0; i < 4; i++) await game.tapControl('ANOTAR');
    const list = await game.hook((pf) => pf.tickets().filter((t) => t.track === 'balcao'));
    const visible = list.filter((t) => t.rect);
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(visible.length).toBeLessThanOrEqual(RAIL_VISIBLE);
    // da esquerda para a direita, na ordem de entrada
    const xs = visible.map((t) => t.rect!.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(visible.map((t) => t.num)).toEqual([...visible.map((t) => t.num)].sort((a, b) => a - b));
  });

  test('RN-182: a comanda recusa o pastel de outro sabor sem custo', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, items: x.lines.map((l) => l.item) };
    });
    const wrong = ['carne', 'queijo'].find((i) => !c.items.includes(i));
    test.skip(!wrong, 'o cliente pediu os dois sabores; sem sabor errado possível com esta semente');
    const id = await readyPastry(game, wrong!);
    await selectReady(game, id);
    const label = (await game.comanda({ owner: c.id }))!.label;
    const failures = await game.hook((pf) => pf.sim.state.rep.failures);
    await game.porNaComanda(label);
    const r = await game.hook((pf, a) => ({ ready: pf.sim.state.ready.some((x) => x.id === a.id), failures: pf.sim.state.rep.failures }), { id });
    expect(r.ready, 'o pastel continua pronto').toBe(true);
    expect(r.failures).toBe(failures);
    expect(await openItems(game, c.id)).toEqual(c.items);
  });

  test('RN-183: com o pasteleiro fora do balcão, tocar na comanda não põe o pastel; leva ele até o balcão', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, item: x.lines.find((l) => l.item !== 'caldo-puro')?.item ?? 'carne' };
    });
    const id = await readyPastry(game, c.item);
    await selectReady(game, id);
    await game.goTo('moenda');
    const label = (await game.comanda({ owner: c.id }))!.label;
    await game.porNaComanda(label);
    expect(await game.hook((pf, rid) => pf.sim.state.ready.some((x) => x.id === rid), id), 'o pastel não entrou na comanda').toBe(true);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBe('balcao');
  });

  test('RN-184: com um pastel escolhido, só as comandas que aceitam o sabor ficam destacadas', async ({ game }) => {
    await game.startDay();
    await game.advanceUntil((pf) => pf.queue().length >= 2, 120, undefined, 6);
    await game.goTo('balcao');
    await game.tapControl('ANOTAR');
    await game.tapControl('ANOTAR');
    const ts = await game.hook((pf) => pf.tickets().map((t) => ({ id: t.id, items: t.slots.map((s) => s.item) })));
    const item = ts[0].items.find((i) => !isDrink(i))!;
    const id = await readyPastry(game, item);
    await selectReady(game, id);
    const dest = await game.destaques();
    for (const t of ts) expect(dest.includes(t.id), `comanda ${t.id} (${t.items.join(',')})`).toBe(t.items.includes(item));
  });

  test('RN-185: tocar na comanda sem nada escolhido faz a placa do dono piscar', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    await takeOrder(game);
    const t = (await game.hook((pf) => pf.tickets()))[0];
    await game.porNaComanda(t.label);
    expect(await game.hook((pf) => pf.env.ui.flash?.ticketId ?? null)).toBe(t.id);
    await game.advance(1.2);
    expect(await game.hook((pf) => pf.env.ui.flash)).toBeNull();
  });

  test('RN-185: tocar no cliente com um pastel escolhido põe o pastel na comanda dele', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, item: x.lines.find((l) => l.item !== 'caldo-puro')?.item ?? 'carne', n: x.lines.length };
    });
    const id = await readyPastry(game, c.item);
    await selectReady(game, id);
    await game.tocarDono((await game.comanda({ owner: c.id }))!.label);
    expect(await game.hook((pf, rid) => pf.sim.state.ready.some((x) => x.id === rid), id), 'o pastel saiu do balcão').toBe(false);
    if (c.n > 1) expect((await openItems(game, c.id)).length).toBe(c.n - 1);
  });

  test('RN-186: a comanda completa é entregue sozinha: o cliente paga e sai, e a comanda some do trilho', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    const id = await game.hook((pf) => pf.queue()[0].id);
    const coins = await game.hook((pf) => pf.sim.state.coins.length);
    await serveCustomer(game, id);
    const r = await game.hook((pf, cid) => ({ there: pf.sim.state.customers.some((x) => x.id === cid), t: pf.tickets().some((t) => t.owner === cid), coins: pf.sim.state.coins.length }), id);
    expect(r.there).toBe(false);
    expect(r.t).toBe(false);
    expect(r.coins).toBe(coins + 1);
  });

  test('RN-186/RN-82: a comanda M completa leva o grupo a comer', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay({ campaign: { patch: withTables } });
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => !!c.group && c.place === 'fila'), 240, undefined, 30);
    const id = await game.hook((pf) => pf.sim.state.customers.find((x) => !!x.group && x.place === 'fila')!.id);
    await serveCustomer(game, id);
    expect(await game.hook((pf, cid) => pf.sim.state.eating.some((x) => x.id === cid), id)).toBe(true);
    expect(await game.comanda({ owner: id })).toBeNull();
  });

  test('RN-187: a Montagem produz primeiro os itens do pedido que entrou primeiro', async ({ game }) => {
    test.setTimeout(240_000);
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Montagem 1');
    await game.openFair();
    await game.goTo('balcao');
    await game.advanceUntil((pf) => pf.queue().length >= 1, 120, undefined, 6);
    await game.tapControl('ANOTAR');
    const first = await game.hook((pf) => pf.tickets()[0].slots.map((s) => s.item).find((i) => i !== 'caldo-puro') ?? null);
    test.skip(!first, 'o primeiro pedido é só de caldo');
    await game.advanceUntil((pf) => pf.sim.state.assembled.length > 0 || pf.sim.state.tachos.some((t) => t.baskets.some((b) => !!b.frying)), 30);
    const made = await game.hook((pf) => pf.sim.state.assembled[0]?.item ?? pf.sim.state.tachos.flatMap((t) => t.baskets).find((b) => b.frying)?.frying?.item);
    expect(made).toBe(first);
  });

  test('RN-188: o funcionário do Balcão põe o pronto na comanda mais antiga que aceita o sabor', async ({ game }) => {
    test.setTimeout(240_000);
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await game.openFair();
    await game.tapStation('bancada'); // o pasteleiro sai do balcão: a posição é do funcionário
    await game.advanceUntil((pf) => pf.sim.state.tickets.length >= 2, 120, undefined, 6);
    const ts = await game.hook((pf) => pf.tickets().map((t) => ({ id: t.id, items: t.slots.filter((s) => !s.filled).map((s) => s.item) })));
    const item = ts[0].items.find((i) => !isDrink(i));
    test.skip(!item, 'a comanda mais antiga só tem caldo');
    const target = ts.find((t) => t.items.includes(item!))!;
    const before = target.items.length;
    await readyPastry(game, item!);
    await game.tapStation('bancada');
    await game.advanceUntil((pf, a) => (pf.tickets().find((t) => t.id === a.tid)?.slots.filter((s) => !s.filled).length ?? 0) < a.before, 6, { tid: target.id, before });
    const after = await game.hook((pf, tid) => pf.tickets().find((t) => t.id === tid)?.slots.filter((s) => !s.filled).length ?? 0, target.id);
    expect(after).toBe(before - 1);
  });

  test('RN-07: às 14h as comandas abertas somem sem falha', async ({ game }) => {
    test.setTimeout(240_000);
    await game.startDay();
    await game.advance((6.98 * 240) / 7); // 13h58
    await game.waitCustomer(30);
    await takeOrder(game);
    const failures = await game.hook((pf) => pf.sim.state.rep.failures);
    expect((await game.hook((pf) => pf.tickets())).length).toBeGreaterThan(0);
    await game.runToEnd();
    const r = await game.lastHook((pf) => ({ t: pf.sim.state.tickets.length, f: pf.sim.state.rep.failures }));
    expect(r.t).toBe(0);
    expect(r.f).toBe(failures);
  });

  test('spec 4: dois toques seguidos na comanda põem o pastel uma vez só', async ({ game }) => {
    await game.startDay();
    await game.waitCustomer();
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, item: x.lines.find((l) => l.item !== 'caldo-puro')?.item ?? 'carne', n: x.lines.length };
    });
    const id = await readyPastry(game, c.item);
    await selectReady(game, id);
    const t = (await game.comanda({ owner: c.id }))!;
    const r = t.rect!;
    await game.ev.quiet(async () => {
      await game.tapAt(r.x + r.w / 2, r.y + r.h / 2);
      await game.tapAt(r.x + r.w / 2, r.y + r.h / 2);
      await game.frames(2);
    });
    await game.ev.action(`Dois toques na comanda ${t.label}`);
    if (c.n > 1) expect((await openItems(game, c.id)).length).toBe(c.n - 1);
    else expect(await game.comanda({ owner: c.id })).toBeNull();
  });
});
