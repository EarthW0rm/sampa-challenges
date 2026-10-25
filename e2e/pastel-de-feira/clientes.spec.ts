import { DIRT_PATIENCE_FACTOR, PATIENCE, QUEUE_CALM_MIN, QUEUE_CALM_STEP, QUEUE_MAX } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test } from './support/game';
import { assemble, deliver, fry } from './support/flow';

/** RN-02, RN-04, RN-05, RN-06, RN-06b, RN-133 (paciência), HUD da fila. */
test.describe('Clientes, fila e paciência', () => {
  test.beforeEach(async ({ game }) => {
    await game.startDay();
  });

  test('RN-02: no dia 1 o primeiro cliente chega dentro de ~2 intervalos médios (12 s)', async ({ game }) => {
    await game.waitCustomer(24);
  });

  test('RN-05: cada cliente pede 1 a 2 pastéis e 0 a 1 caldo, só do cardápio', async ({ game }) => {
    await game.advanceUntil((pf) => pf.sim.state.customers.length >= 4, 120);
    const orders = await game.hook((pf) => pf.sim.state.customers.map((c) => c.lines.map((l) => l.item)));
    for (const o of orders) {
      const pastries = o.filter((i) => i === 'carne' || i === 'queijo').length;
      const drinks = o.filter((i) => i === 'caldo-puro').length;
      expect(pastries).toBeGreaterThanOrEqual(1);
      expect(pastries).toBeLessThanOrEqual(2);
      expect(drinks).toBeLessThanOrEqual(1);
      expect(pastries + drinks).toBe(o.length);
    }
  });

  test('RN-06: paciência inicial pelo perfil', async ({ game }) => {
    await game.waitCustomer();
    const c = await game.hook((pf) => pf.sim.state.customers.map((x) => ({ profile: x.profile, max: x.patienceMax })));
    for (const x of c) expect(x.max).toBe(PATIENCE[x.profile as keyof typeof PATIENCE]);
  });

  test('RN-06b: o primeiro da fila gasta 1 s de paciência por segundo; quem está atrás, menos', async ({ game }) => {
    await game.advanceUntil((pf) => pf.queue().length >= 3, 120);
    const read = () => game.hook((pf) => pf.queue().map((q) => pf.sim.state.customers.find((c) => c.id === q.id)!).map((c) => ({ id: c.id, p: c.patience })));
    const a = await read();
    await game.frames(60);
    const b = await read();
    for (let i = 0; i < 3; i++) {
      if (a[i].id !== b[i].id) continue; // alguém saiu no meio do segundo
      const rate = a[i].p - b[i].p;
      expect(rate, `posição ${i}`).toBeCloseTo(Math.max(QUEUE_CALM_MIN, 1 - QUEUE_CALM_STEP * i), 1);
    }
  });

  test('RN-133: com sujeira ≥ 60 a paciência gasta 25% mais rápido (−20% de paciência)', async ({ game }) => {
    await game.waitCustomer();
    await game.hook((pf) => {
      pf.sim.state.dirt = 60;
    });
    const p0 = await game.hook((pf) => pf.sim.state.customers.find((c) => c.id === pf.queue()[0].id)!.patience);
    await game.frames(60);
    const p1 = await game.hook((pf) => pf.sim.state.customers.find((c) => c.id === pf.queue()[0].id)!.patience);
    expect(p0 - p1).toBeCloseTo(1 / DIRT_PATIENCE_FACTOR, 1);
  });

  test('RN-06: esgotada a paciência o cliente vai embora sem pagar (falha)', async ({ game }) => {
    await game.waitCustomer();
    const first = await game.hook((pf) => pf.queue()[0].id);
    await game.advanceUntil((pf, id) => !pf.sim.state.customers.some((c) => c.id === id), 100, first, 60);
    const s = await game.hook((pf) => ({ lost: pf.sim.state.stats.lostPatience, failures: pf.sim.state.rep.failures, revenue: pf.sim.state.stats.revenue }));
    expect(s.lost).toBeGreaterThanOrEqual(1);
    expect(s.failures).toBeGreaterThanOrEqual(1);
    expect(s.revenue).toBe(0);
  });

  test('RN-04: a fila nunca passa de 6; quem chega com a fila cheia vai embora (peso 0,5)', async ({ game }) => {
    await game.advanceUntil((pf) => pf.sim.state.stats.queueFull > 0, 200, undefined, 60);
    const max = await game.hook((pf) => pf.queue().length);
    expect(max).toBeLessThanOrEqual(QUEUE_MAX);
  });

  test('HUD: "Fila N" acompanha o número de clientes', async ({ game, page }) => {
    await game.advanceUntil((pf) => pf.sim.state.customers.length >= 2, 120);
    await game.frames(7);
    const n = await game.hook((pf) => pf.sim.state.customers.length);
    await expect(page.locator('.pastel-de-feira .hud')).toContainText(`Fila ${n}`);
  });

  test('o toque acerta o cliente desenhado na 3ª posição da fila (entrega vai para ele)', async ({ game }) => {
    await game.advanceUntil((pf) => pf.queue().length >= 3, 120);
    await game.goTo('balcao');
    for (let i = 0; i < 3; i++) await game.tapControl('ANOTAR');
    await assemble(game, 'carne');
    const p = await fry(game, 6.5);
    const target = await game.hook((pf) => pf.queue()[2]?.id ?? null);
    test.skip(target === null, 'a fila encurtou antes da entrega');
    await deliver(game, { kind: 'pastel', id: p.id }, 2);
    const c = await game.hook((pf, id) => {
      const x = pf.sim.state.customers.find((k) => k.id === id);
      return x ? { wrong: x.wrong, delivered: x.lines.some((l) => l.delivered !== null) } : { wrong: false, delivered: true };
    }, target);
    expect(c.wrong || c.delivered, 'o cliente da 3ª posição recebeu (ou recusou) o pastel').toBe(true);
    // e ninguém mais recebeu nada
    const others = await game.hook((pf, id) => pf.sim.state.customers.filter((k) => k.id !== id).some((k) => k.wrong || k.lines.some((l) => l.delivered !== null)), target);
    expect(others).toBe(false);
  });
});
