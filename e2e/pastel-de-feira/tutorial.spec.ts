import { expect, test } from './support/game';
import { assemble, collect, deliver, fry, mill, takeOrder } from './support/flow';

/** RN-170, RN-173: tutorial guiado do dia 1. */
test.describe('Tutorial do dia 1', () => {
  test.beforeEach(async ({ game }) => {
    await game.startDay({ campaign: { options: { tutorial: true } } });
  });

  test('mostra a dica de espera e o relógio anda até o primeiro cliente', async ({ game, page }) => {
    await game.frames(7);
    await expect(page.locator('.pastel-de-feira .tutorial-tip')).toHaveText('Aguarde o primeiro cliente chegar.');
    const t = await game.tick();
    await game.frames(60);
    expect(await game.tick()).toBeGreaterThan(t);
  });

  test('RN-173: o 2× fica desligado durante os passos guiados', async ({ game, page }) => {
    await game.frames(7);
    await expect(page.getByRole('button', { name: 'Acelerar' })).toBeDisabled();
    await page.keyboard.press('KeyF');
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.speed)).toBe(1);
  });

  test('RN-170: no passo "anotar" o relógio para, mas o pasteleiro anda', async ({ game, page }) => {
    await game.advanceUntil((pf) => pf.sim.state.customers.length > 0, 60, undefined, 1).catch(async () => {
      throw new Error('cliente não chegou no tutorial');
    });
    await game.frames(2);
    await game.frames(7);
    await expect(page.locator('.pastel-de-feira .tutorial-tip')).toContainText('Toque na fila para anotar');
    const t = await game.tick();
    await game.tapStation('moenda');
    await game.frames(60);
    expect(await game.tick(), 'relógio parado').toBe(t);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.at), 'pasteleiro andou com o relógio parado').toBe('moenda');
  });

  test('RN-170: o primeiro pedido guiado até o fim libera o relógio e some com a dica', async ({ game, page }) => {
    await game.advanceUntil((pf) => pf.sim.state.customers.length > 0, 60, undefined, 1);
    await game.frames(2);
    await takeOrder(game);
    const c = await game.hook((pf) => {
      const x = pf.sim.state.customers.find((k) => k.state === 'anotado')!;
      return { id: x.id, items: x.lines.map((l) => l.item) };
    });
    for (const item of c.items) {
      if (item === 'caldo-puro') {
        await mill(game, 6);
        const cup = await game.hook((pf) => pf.sim.state.cups[0].id);
        await deliver(game, { kind: 'copo', id: cup });
      } else {
        await assemble(game, item);
        const p = await fry(game, 6.5);
        await deliver(game, { kind: 'pastel', id: p.id });
      }
    }
    await collect(game);
    await game.frames(7);
    await expect(page.locator('.pastel-de-feira .tutorial-tip')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Acelerar' })).toBeEnabled();
    const t = await game.tick();
    await game.frames(60);
    expect(await game.tick()).toBeGreaterThan(t + 50);
  });
});
