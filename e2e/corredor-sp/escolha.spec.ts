import { BREEDS, CATEGORIES, COLORS, MODELS, TRACKS } from '../../src/games/corredor-sp/game/data';
import { CHOICE_KEY } from './support/page';
import { expect, test } from './support/test';

test.describe('Corredor SP — escolha da moto e da pista', () => {
  test('CS-RN-01 cada grupo marca uma opção; trocar a categoria marca o 1º modelo dela; prévia acompanha', async ({ game, page }) => {
    await game.open();
    // padrão sem escolha salva
    await expect(game.trackButton('23-de-maio')).toHaveAttribute('aria-pressed', 'true');
    await expect(game.modelButton('entregadora')).toHaveAttribute('aria-pressed', 'true');
    for (const t of TRACKS) {
      await game.trackButton(t.id).click();
      for (const o of TRACKS) await expect(game.trackButton(o.id)).toHaveAttribute('aria-pressed', String(o.id === t.id));
    }
    for (const b of BREEDS) await game.breedButton(b.id).click();
    for (const b of BREEDS) await expect(game.breedButton(b.id)).toHaveAttribute('aria-pressed', String(b.id === BREEDS[BREEDS.length - 1].id));
    for (const c of CATEGORIES) {
      await game.categoryButton(c.id).click();
      const models = MODELS.filter((m) => m.category === c.id);
      await expect(page.locator('.corredor-sp .model'), `3 modelos da categoria ${c.id}`).toHaveCount(models.length);
      await expect(game.modelButton(models[0].id)).toHaveAttribute('aria-pressed', 'true');
      await game.modelButton(models[2].id).click();
      await expect(game.modelButton(models[2].id)).toHaveAttribute('aria-pressed', 'true');
      await expect(game.modelButton(models[0].id)).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('.corredor-sp .preview p')).toContainText(models[2].name);
      for (const m of models) await expect(game.modelButton(m.id)).toContainText(`${m.vmax} km/h`);
    }
    await game.colorButton(COLORS[3].id).click();
    for (const c of COLORS) await expect(game.colorButton(c.id)).toHaveAttribute('aria-pressed', String(c.id === COLORS[3].id));
    await expect(page.locator('.corredor-sp .preview p')).toContainText(COLORS[3].name.toLowerCase());
  });

  test('CS-RN-02 a escolha é gravada ao correr e volta marcada; CS-RN-30 trocar moto ou pista volta à escolha', async ({ game, page }) => {
    await game.open();
    const choice = { track: 'radial-leste', breed: 'pitbull', category: '600', modelId: 'marimbondo', colorId: 'verde' } as const;
    await game.choose(choice);
    await game.start();
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CHOICE_KEY)) ?? 'null')).toEqual(choice);
    const s = await game.state();
    expect(s.track).toBe(choice.track);
    expect(s.model.id).toBe(choice.modelId);
    await page.getByRole('button', { name: '← Trocar moto ou pista' }).click();
    await expect(game.setupTitle).toBeVisible();
    expect(await game.hasHook(), 'turno descartado').toBe(false);
    await expect(game.modelButton(choice.modelId)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(game.setupTitle).toBeVisible();
    await expect(game.trackButton(choice.track)).toHaveAttribute('aria-pressed', 'true');
    await expect(game.breedButton(choice.breed)).toHaveAttribute('aria-pressed', 'true');
    await expect(game.categoryButton(choice.category)).toHaveAttribute('aria-pressed', 'true');
    await expect(game.modelButton(choice.modelId)).toHaveAttribute('aria-pressed', 'true');
    await expect(game.colorButton(choice.colorId)).toHaveAttribute('aria-pressed', 'true');
  });
});
