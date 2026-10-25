import { expect, HUB_GAMES, test } from './test';

test.describe('Hub — home', () => {
  test('HUB-RN-50 a home lista um card por jogo, na ordem do registro, com título e capa', async ({ game, page }) => {
    await game.open();
    const cards = await game.cards();
    expect(cards.map((c) => c.id)).toEqual(HUB_GAMES.map((g) => g.id));
    expect(cards.map((c) => c.title)).toEqual(HUB_GAMES.map((g) => g.title));
    expect(cards).toHaveLength(8);
    for (const g of HUB_GAMES) {
      const img = game.card(g.id).locator('.hub-cover img');
      await expect(img).toBeVisible();
      expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth), `capa de ${g.id}`).toBeGreaterThan(0);
    }
    await expect(page.locator('.hub-footer')).toHaveText('8 jogos');
  });

  test('HUB-RN-50 o card mostra o recorde guardado; sem recorde, nada aparece', async ({ game }) => {
    await game.open({ storage: { 'cachorro-loko:recorde': '123', 'pinball-paulista:recorde': '0' } });
    const cards = await game.cards();
    expect(cards.find((c) => c.id === 'cachorro-loko')?.record).toBe('Recorde 123');
    expect(cards.find((c) => c.id === 'pinball-paulista')?.record, 'recorde 0 não aparece').toBeNull();
    expect(cards.find((c) => c.id === 'capacete-voador')?.record, 'jogo sem recorde').toBeNull();
  });
});
