import type { Shot } from '../../src/games/sinuca-de-bar/game/ai';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — IA no worker', () => {
  test('SB-RN-33 mesma semente, mesma tacada do computador em duas cargas', async ({ game, page }) => {
    const shots: Shot[] = [];
    for (let run = 0; run < 2; run++) {
      if (run === 0) await game.open({ seed: 21 });
      else {
        await page.reload();
        await expect(page.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
      }
      await game.menu({ mode: 'pvc', level: 2, breaker: 'p1' });
      // Ana sai com a força padrão; depois a vez é do computador (fora da saída: busca completa)
      await game.shoot();
      await game.advanceUntil((h) => h.state().shots > 0, 40, undefined, 30);
      const s = await game.state();
      if (s.turn === 0) test.skip(true, 'a saída encaçapou: a semente escolhida deveria passar a vez');
      await expect.poll(async () => (await game.state()).ai.received, { timeout: 15_000 }).toBe(1);
      shots.push((await game.state()).ai.lastShot!);
      await game.evidence(`Carga ${run + 1}: tacada do computador ${JSON.stringify(shots[run])}`);
    }
    expect(shots[1]).toEqual(shots[0]);
  });

  test('SB-RN-33 worker que falha: a busca roda na página e a partida continua', async ({ game, page }) => {
    await page.addInitScript(() => {
      // Worker que não carrega: dispara onerror logo depois de criado
      (window as unknown as { Worker: unknown }).Worker = class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: unknown = null;
        constructor() {
          setTimeout(() => this.onerror?.(new Event('error')), 0);
        }
        postMessage() {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
      };
    });
    await game.start({ mode: 'pvc', level: 1, breaker: 'p2' });
    await game.advanceUntil((h) => h.state().shots > 0, 40, undefined, 30);
    const s = await game.state();
    expect(s.ai.worker).toBe(false);
    expect(s.ai.fallback).toBeGreaterThan(0);
    expect(s.ai.received).toBeGreaterThan(0);
    expect(s.lastShot!.by, 'o computador deu a saída').toBe(1);
  });

  test('SB-RN-33 resposta que chega depois de Nova partida é descartada', async ({ game, page }) => {
    await page.addInitScript(() => {
      // segura as respostas do worker até o teste liberar
      const w = window as unknown as { Worker: typeof Worker; __aiHeld: (() => void)[]; __releaseAi: () => void };
      const Real = w.Worker;
      w.__aiHeld = [];
      w.__releaseAi = () => w.__aiHeld.splice(0).forEach((f) => f());
      w.Worker = class extends Real {
        private h: ((e: MessageEvent) => void) | null = null;
        constructor(u: string | URL, o?: WorkerOptions) {
          super(u, o);
          super.onmessage = (e: MessageEvent) => w.__aiHeld.push(() => this.h?.(e));
        }
        set onmessage(h: ((e: MessageEvent) => void) | null) {
          this.h = h;
        }
        get onmessage(): ((e: MessageEvent) => void) | null {
          return this.h;
        }
      } as unknown as typeof Worker;
    });
    await game.start({ mode: 'pvc', level: 1, breaker: 'p2' });
    await game.frames(2);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __aiHeld: unknown[] }).__aiHeld.length)).toBe(1);
    expect((await game.state()).thinking).toBe(true);
    await page.getByRole('button', { name: 'Nova partida' }).click();
    await page.getByRole('button', { name: 'Abandonar esta partida?' }).click();
    await game.frames(1);
    const before = await game.state();
    expect(before).toMatchObject({ turn: 0, breaker: 0, thinking: false });
    await page.evaluate(() => (window as unknown as { __releaseAi: () => void }).__releaseAi());
    await game.frames(30);
    const s = await game.state();
    expect(s.ai.discarded).toBe(1);
    expect(s.ai.received).toBe(0);
    expect(s).toMatchObject({ turn: 0, phase: 'aim', cpu: null });
    expect(s.balls).toEqual(before.balls);
  });
});
