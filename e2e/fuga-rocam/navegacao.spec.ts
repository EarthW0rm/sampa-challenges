import { MAPS } from '../../src/games/fuga-rocam/game/maps';
import { recordKey } from './support/page';
import { expect, test } from './support/test';

test.describe('Fuga da Rocam — título e navegação', () => {
  test('FR-RN-01 título lista os 3 mapas com o recorde de cada um; clique e tecla escolhem; ← Mapas volta', async ({ game, page }) => {
    await game.open({ storage: { [recordKey('paulista')]: '1234' } });
    const cards = page.locator('.fuga-rocam .map-card');
    await expect(cards).toHaveCount(MAPS.length);
    for (const [i, m] of MAPS.entries()) {
      await expect(cards.nth(i).locator('.map-name')).toHaveText(`${i + 1}. ${m.name}`);
      await expect(cards.nth(i).locator('.map-rec')).toHaveText(m.id === 'paulista' ? 'Recorde: 1.234' : 'Sem recorde ainda');
    }
    expect(await game.hasHook(), 'sem partida, sem motor').toBe(false);

    // tecla fora de 1–3 não faz nada
    await game.pressKey('Digit9');
    await expect(cards).toHaveCount(MAPS.length);

    await game.chooseMap('marginal', 'tecla');
    await expect(page.locator('.fuga-rocam .map-title')).toHaveText('Marginal Pinheiros');
    expect((await game.state()).map).toBe('marginal');
    await page.getByRole('button', { name: '← Mapas' }).click();
    await expect(cards).toHaveCount(MAPS.length);
    expect(await game.hasHook(), 'gancho limpo ao sair da partida').toBe(false);

    await game.chooseMap('centro', 'clique');
    const s = await game.state();
    expect(s.map).toBe('centro');
    expect(s.phase).toBe('ready');
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });
});
