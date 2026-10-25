/**
 * Ações de alto nível do pasteleiro, feitas só por cliques no canvas (o gancho é usado para ler o
 * estado e localizar alvos, nunca para injetar comandos).
 */
import { ingredientLabel as gameLabel } from '../../../src/games/pastel-de-feira/game/data/catalog';
import { ITEMS } from '../../../src/games/pastel-de-feira/game/data/recipes';
import type { StationId } from '../../../src/games/pastel-de-feira/game/types';
import { expect, type GamePage } from './game';

/** Rótulo do ingrediente no painel da bancada (o mesmo corte de `panel.ts`). */
export const ingredientLabel = (ing: string): string => gameLabel(ing);

export const isDrink = (item: string): boolean => ITEMS[item].kind === 'bebida';

/** Janela do ponto e queima (s) do item, sem termostato. */
export function fryTimes(item: string): { ponto: readonly [number, number]; burnAt: number } {
  const it = ITEMS[item];
  return { ponto: it.ponto, burnAt: it.burnAt };
}

/** No balcão: anota o cliente da frente pelo botão ANOTAR. */
export function takeOrder(game: GamePage): Promise<void> {
  return game.step('Anotar o pedido do cliente da frente', async () => {
    await game.goTo('balcao');
    await game.tapControl('ANOTAR');
  });
}

/** Na bancada: toca nos recheios do item e em FECHAR. Devolve o id do pastel montado. */
export function assemble(game: GamePage, item: string): Promise<number> {
  return game.step(`Montar ${item} na bancada`, () => assembleSteps(game, item));
}

async function assembleSteps(game: GamePage, item: string): Promise<number> {
  await game.goTo('bancada');
  const before = await game.hook((pf) => pf.sim.state.assembled.map((a) => a.id));
  for (const ing of ITEMS[item].filling) await game.tapControl(ingredientLabel(ing));
  await game.tapControl('FECHAR');
  const after = await game.hook((pf) => pf.sim.state.assembled.map((a) => ({ id: a.id, item: a.item })));
  const made = after.find((a) => !before.includes(a.id));
  expect(made, `montar ${item}`).toBeTruthy();
  expect(made!.item).toBe(item);
  return made!.id;
}

/** No tacho: toca no cesto (coloca o pastel montado, ou tira o que está fritando). */
export function tapBasket(game: GamePage, basket = 0, tacho: StationId = 'tacho1'): Promise<void> {
  return game.step(`Tocar no cesto ${basket + 1} do ${tacho}`, async () => {
    await game.goTo(tacho);
    await game.tapControl('CESTO ' + (basket + 1));
  });
}

/** Segundos de fritura do pastel no cesto. */
export function fryingSeconds(game: GamePage, basket = 0, tacho = 0): Promise<number | null> {
  return game.hook(
    (pf, a) => {
      const f = pf.sim.state.tachos[a.tacho].baskets[a.basket].frying;
      return f ? f.ticks / 60 : null;
    },
    { basket, tacho },
  );
}

/** Coloca, espera `seconds` de fritura e tira. Devolve o pastel pronto (nota de saída). */
export function fry(game: GamePage, seconds: number, basket = 0): Promise<{ id: number; item: string; quality: number }> {
  return game.step(`Fritar ${seconds} s no cesto ${basket + 1}`, () => frySteps(game, seconds, basket));
}

async function frySteps(game: GamePage, seconds: number, basket: number): Promise<{ id: number; item: string; quality: number }> {
  await tapBasket(game, basket);
  const left = seconds - ((await fryingSeconds(game, basket)) ?? 0);
  if (left > 0) await game.frames(Math.round(left * 60));
  const before = await game.hook((pf) => pf.sim.state.ready.map((r) => r.id));
  await game.goTo('tacho1'); // o painel recolheu durante a espera (4 s sem interação): toca no tacho de novo
  await game.tapControl('CESTO ' + (basket + 1));
  const ready = await game.hook((pf) => pf.sim.state.ready.map((r) => ({ id: r.id, item: r.item, quality: r.quality })));
  const out = ready.find((r) => !before.includes(r.id));
  expect(out, `tirar do cesto ${basket + 1} aos ${seconds}s`).toBeTruthy();
  return out!;
}

/** Na moenda: segura o botão do caldo pelo tempo da extração (mais uma folga de 2 quadros). */
export function mill(game: GamePage, seconds: number, label: string | RegExp = 'PURO'): Promise<void> {
  return game.step(`Moer caldo ${String(label)} por ${+seconds.toFixed(2)} s`, async () => {
    await game.goTo('moenda');
    await game.holdControl(label, seconds + 2 / 60);
  });
}

/** No balcão: seleciona o pastel pronto (ou copo) pelo id e toca no cliente da frente. */
export function deliver(game: GamePage, ref: { kind: 'pastel' | 'copo'; id: number }, queueIndex = 0): Promise<void> {
  return game.step(`Entregar ${ref.kind} #${ref.id} ao cliente na posição ${queueIndex} da fila`, () => deliverSteps(game, ref, queueIndex));
}

async function deliverSteps(game: GamePage, ref: { kind: 'pastel' | 'copo'; id: number }, queueIndex: number): Promise<void> {
  await game.goTo('balcao');
  const index = await game.hook((pf, r) => {
    const st = pf.sim.state;
    const ctl = pf.controls();
    const base = ctl.findIndex((c) => c.label === 'VASSOURA') + 1;
    const ready = st.ready.filter((x) => x.reservedFor === undefined).slice(0, 7);
    if (r.kind === 'pastel') return base + ready.findIndex((x) => x.id === r.id);
    return base + ready.length + st.cups.slice(0, 5).findIndex((x) => x.id === r.id);
  }, ref);
  const ctl = (await game.controls())[index];
  expect(ctl, `controle do item ${ref.kind} ${ref.id}`).toBeTruthy();
  await game.ev.quiet(async () => {
    await game.tapAt(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2);
    await game.frames(1);
  });
  await game.ev.action(`Selecionar ${ref.kind} #${ref.id} no painel do balcão ("${ctl.label}")`);
  expect(await game.hook((pf) => pf.env.ui.selected), 'item selecionado').toEqual(ref);
  await game.tapCustomer(queueIndex);
}

/** Atende por completo o cliente da frente (anota, monta, frita no ponto, mói, entrega). Devolve o id. */
export async function serveFront(game: GamePage): Promise<number> {
  await game.waitCustomer(90);
  const id = await game.hook((pf) => pf.queue()[0].id);
  await serveCustomer(game, id);
  return id;
}

/** Atende por completo um cliente da fila do balcão: anota (ANOTAR até chegar nele), produz e entrega cada item. */
export function serveCustomer(game: GamePage, id: number): Promise<void> {
  return game.step(`Atender o cliente #${id}`, () => serveSteps(game, id));
}

async function serveSteps(game: GamePage, id: number): Promise<void> {
  await game.goTo('balcao');
  for (let i = 0; i < 8; i++) {
    const st = await game.hook((pf, cid) => pf.sim.state.customers.find((k) => k.id === cid)?.state ?? null, id);
    expect(st, `cliente ${id} ainda na barraca`).not.toBeNull();
    if (st === 'anotado') break;
    await game.tapControl('ANOTAR');
  }
  const items = await game.hook((pf, cid) => pf.sim.state.customers.find((k) => k.id === cid)!.lines.filter((l) => l.delivered === null).map((l) => l.item), id);
  for (const item of items) {
    if (isDrink(item)) {
      const before = await game.hook((pf) => pf.sim.state.cups.map((x) => x.id));
      await mill(game, await game.hook((pf) => (pf.sim.state.config.equipment.mill === 'motorizada' ? 2.5 : 6) + 0.3 * pf.sim.state.config.promo.chorinho));
      const cup = (await game.hook((pf) => pf.sim.state.cups.map((x) => x.id))).find((x) => !before.includes(x));
      expect(cup, 'copo de caldo').toBeTruthy();
      await deliver(game, { kind: 'copo', id: cup! }, await queuePos(game, id));
    } else {
      await assemble(game, item);
      const t = fryTimes(item);
      const p = await fry(game, (t.ponto[0] + t.ponto[1]) / 2);
      await deliver(game, { kind: 'pastel', id: p.id }, await queuePos(game, id));
    }
  }
}

/** Posição do cliente na fila do balcão. */
export async function queuePos(game: GamePage, id: number): Promise<number> {
  const q = await game.hook((pf) => pf.queue().map((c) => c.id));
  const i = q.indexOf(id);
  expect(i, `cliente ${id} na fila`).toBeGreaterThanOrEqual(0);
  return i;
}

/** No balcão: COBRAR (recolhe as moedas). */
export function collect(game: GamePage): Promise<void> {
  return game.step('Cobrar (recolher as moedas do balcão)', async () => {
    await game.goTo('balcao');
    await game.tapControl('COBRAR');
  });
}
