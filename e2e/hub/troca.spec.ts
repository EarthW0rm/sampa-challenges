import { expect, HUB_GAMES, test } from './test';

/** Conta os listeners de teclado da janela (instrumenta add/removeEventListener antes do app carregar). */
function countKeyListeners(): void {
  const w = window as unknown as { __keyListeners: number };
  w.__keyListeners = 0;
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  const live = new Set<unknown>();
  window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
    if ((type === 'keydown' || type === 'keyup') && !live.has(fn)) {
      live.add(fn);
      w.__keyListeners = live.size;
    }
    add(type, fn, opts);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | EventListenerOptions) => {
    if (type === 'keydown' || type === 'keyup') {
      live.delete(fn);
      w.__keyListeners = live.size;
    }
    remove(type, fn, opts);
  }) as typeof window.removeEventListener;
}

test.describe('Hub — troca de jogo', () => {
  test('HUB-RN-52 trocar de jogo desmonta o anterior: nenhum laço nem listener de teclado sobra', async ({ game, page }) => {
    await page.addInitScript(countKeyListeners);
    await game.open();
    const keys = () => page.evaluate(() => (window as unknown as { __keyListeners: number }).__keyListeners);
    const homeKeys = await keys();
    expect(await game.rafPending(), 'a home não tem laço').toBe(0);
    for (const g of HUB_GAMES) {
      await game.step(`Abrir e fechar ${g.id}`, async () => {
        await game.openGame(g.id);
        await game.frames(2);
        await game.back();
        await game.frames(2);
        expect(await game.rafPending(), `laço de ${g.id} vivo depois de voltar`).toBe(0);
        expect(await keys(), `listener de teclado de ${g.id} vivo depois de voltar`).toBe(homeKeys);
      });
    }
  });

  test('HUB-RN-52 abrir A, voltar e abrir B deixa só os laços de B', async ({ game }) => {
    await game.open();
    await game.openGame('fuga-rocam');
    await game.frames(2);
    await game.back();
    await game.openGame('cachorro-loko');
    await game.frames(2);
    const afterSwap = await game.rafPending();
    await game.back();
    await game.openGame('cachorro-loko');
    await game.frames(2);
    expect(afterSwap, 'mesma fila de quadros que o jogo B sozinho').toBe(await game.rafPending());
    expect(afterSwap).toBeLessThanOrEqual(1);
  });
});
