import { START_LIVES } from '../../src/games/cachorro-loko/game/constants';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — navegação', () => {
  test('CL-RN-01 CL-RN-28 título, início pelo Enter, ← Menu e volta ao hub', async ({ game, page }) => {
    await game.openTitle();
    await expect(page.getByText(/^Recorde:/), 'sem recorde salvo').toHaveCount(0);
    expect(await game.hasHook(), 'sem motor no título, sem gancho').toBe(false);

    await game.start('Enter');
    await game.frames(1);
    const s = await game.state();
    expect(s).toMatchObject({ phase: 'playing', score: 0, lives: START_LIVES, level: 1, dog: { x: 140, facing: 1 } });
    await expect(page.locator('.cachorro-loko .score')).toHaveText('ENTREGAS 000');
    await expect(page.locator('.cachorro-loko .level')).toHaveText('Nível 1');

    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('heading', { name: 'CACHORRO LOKO' })).toBeVisible();
    expect(await game.hasHook(), 'motor desmontado').toBe(false);

    await game.start('click');
    expect((await game.state()).score).toBe(0);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });

  test('CL-RN-01 Espaço também começa; o gancho não existe sem a flag de teste', async ({ game, page }) => {
    await game.openTitle();
    await game.start('Space');
    expect((await game.state()).phase).toBe('playing');

    // página sem o relógio de teste (sem a flag): o jogo roda, mas não publica gancho
    const plain = await page.context().newPage();
    await plain.goto(`./${game.route}`);
    await plain.getByRole('button', { name: 'Jogar' }).click();
    await expect(plain.locator('.cachorro-loko canvas')).toBeVisible();
    expect(await plain.evaluate(() => 'pastel' in window || '__e2e' in window || '__e2eLast' in window)).toBe(false);
    await plain.close();
  });
});
