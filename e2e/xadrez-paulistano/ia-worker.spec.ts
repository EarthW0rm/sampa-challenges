import { NodeBrain } from './support/brain';
import { expect, test, type XadrezPage } from './support/test';

/** Joga `n` lances do humano (Node, semente fixa) e devolve os lances do computador. */
async function computerLine(game: XadrezPage, n: number): Promise<string[]> {
  const brain = new NodeBrain(30, 3000, 5);
  let s = await game.state();
  await game.ev.quiet(async () => {
    for (let i = 0; i < n && !s.outcome; i++) {
      await game.playUci(brain.choose(s.startFen, s.ucis));
      s = await game.waitComputer();
    }
  });
  await game.evidence(`${n} lances de cada lado`);
  return s.ucis.filter((_, i) => i % 2 === 1);
}

test.describe('Xadrez Paulistano — IA no worker', () => {
  test('XP-RN-26 mesma semente: mesma sequência de 10 lances do computador em duas cargas', async ({ game, page }) => {
    test.setTimeout(180_000);
    await game.start({ mode: 'pvc', level: 40, color: 'Brancas' }, { seed: 99 });
    const first = await computerLine(game, 10);
    expect(first).toHaveLength(10);
    const req = (await game.state()).lastAiRequest;
    expect(req?.seed, 'semente no pedido').toEqual(expect.any(Number));
    expect(req?.nodeBudget).toEqual(expect.any(Number));
    await page.reload();
    await game.play();
    const second = await computerLine(game, 10);
    expect(second).toEqual(first);
  });

  test('XP-RN-26 worker quebrado: o computador joga pela reserva na página', async ({ game, page }) => {
    // Worker que falha ao carregar (como um navegador sem suporte): dispara onerror logo depois de criado
    await page.addInitScript(() => {
      class Broken {
        onmessage: unknown = null;
        onerror: ((e: unknown) => void) | null = null;
        constructor() {
          setTimeout(() => this.onerror?.({ message: 'falha simulada' }), 0);
        }
        postMessage() {}
        terminate() {}
      }
      (window as unknown as { Worker: unknown }).Worker = Broken;
    });
    await game.start({ mode: 'pvc', level: 20, color: 'Pretas' });
    let s = await game.waitComputer();
    expect(s.worker, 'sem worker vivo').toBe(false);
    expect(s.moves).toHaveLength(1);
    await game.move('e7', 'e5');
    s = await game.waitComputer();
    expect(s.moves).toHaveLength(3);
  });

  test('XP-RN-26 XP-RN-19 XP-RN-21 nível 100 em até 5 s; Desfazer e Nova partida durante a busca descartam a resposta', async ({ game, page }) => {
    test.setTimeout(120_000);
    await game.start({ mode: 'pvc', level: 100, color: 'Brancas' });
    await game.clickSquare('e2');
    await game.clickSquare('e4', 20);
    const t0 = Date.now();
    let s = await game.waitComputer();
    const wall = Date.now() - t0;
    expect(wall, `nível 100: ${wall} ms de parede`).toBeLessThanOrEqual(5000);
    expect(s.moves).toHaveLength(2);

    await game.clickSquare('d2');
    await game.clickSquare('d4', 20);
    expect((await game.state()).thinking).toBe(true);
    const before = (await game.state()).lastAiRequest?.id;
    await game.press('Desfazer');
    s = await game.state();
    expect(s.thinking).toBe(false);
    expect(s.moves).toHaveLength(2);
    expect(s.worker, 'worker trocado por outro').toBe(true);
    await page.waitForTimeout(3500);
    await game.frames(60);
    s = await game.state();
    expect(s.moves, 'a resposta antiga não entrou').toHaveLength(2);
    expect(s.humanTurn).toBe(true);
    expect(s.lastAiRequest?.id).toBe(before);

    await game.clickSquare('d2');
    await game.clickSquare('d4', 20);
    expect((await game.state()).thinking).toBe(true);
    await game.press('Nova partida', 'Abandonar esta partida?');
    await page.waitForTimeout(3500);
    await game.frames(60);
    s = await game.state();
    expect(s.moves).toEqual([]);
    expect(s.thinking).toBe(false);
  });
});
