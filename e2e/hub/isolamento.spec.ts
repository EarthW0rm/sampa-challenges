import type { Page } from '@playwright/test';
import { expect, HUB_GAMES, test } from './test';

const PROPS = ['font-family', 'font-size', 'line-height', 'color', 'background-color', 'margin', 'padding', 'display', 'width', 'border-radius', 'box-shadow'];

/** Estilos computados de `body`, da home e do primeiro card. */
function homeStyles(page: Page): Promise<Record<string, Record<string, string>>> {
  return page.evaluate((props) => {
    const pick = (el: Element | null) => {
      const cs = el ? getComputedStyle(el) : null;
      return Object.fromEntries(props.map((p) => [p, cs?.getPropertyValue(p) ?? '']));
    };
    return { body: pick(document.body), home: pick(document.querySelector('.hub-home')), card: pick(document.querySelector('.hub-card')), h1: pick(document.querySelector('.hub-home h1')) };
  }, PROPS);
}

test.describe('Hub — isolamento visual', () => {
  test('HUB-RN-53 a home tem a mesma aparência antes e depois de abrir cada jogo', async ({ game, page }) => {
    await game.open();
    const before = await homeStyles(page);
    for (const g of HUB_GAMES) {
      await game.openGame(g.id);
      await game.back();
      expect(await homeStyles(page), `estilo vazou de ${g.id}`).toEqual(before);
    }
  });

  test('HUB-RN-53 cada jogo tem a mesma aparência antes e depois de abrir os outros', async ({ game, page }) => {
    await game.open();
    const rootStyle = (id: string) =>
      page.evaluate(
        ({ id, props }) => {
          const el = document.querySelector(`.${id}`);
          const cs = el ? getComputedStyle(el) : null;
          return Object.fromEntries(props.map((p) => [p, cs?.getPropertyValue(p) ?? '']));
        },
        { id, props: PROPS },
      );
    const first: Record<string, Record<string, string>> = {};
    for (const g of HUB_GAMES) {
      await game.openGame(g.id);
      first[g.id] = await rootStyle(g.id);
      await game.back();
    }
    for (const g of HUB_GAMES) {
      await game.openGame(g.id);
      expect(await rootStyle(g.id), `estilo de ${g.id} mudou depois de abrir os outros`).toEqual(first[g.id]);
      await game.back();
    }
  });
});
