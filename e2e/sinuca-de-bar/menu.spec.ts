import { LEVELS } from '../../src/games/sinuca-de-bar/game/ai';
import { DEFAULT_SETTINGS } from '../../src/games/sinuca-de-bar/game/config';
import { readStorage } from '../support/storage';
import { CONFIG_KEY, SOUND_KEY } from './support/page';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — menu', () => {
  test('SB-RN-01 opções do menu: modo, regra, nível só contra o computador, nomes até 14 e saída', async ({ game, page }) => {
    await game.open();
    const root = page.locator('.sinuca-de-bar');
    for (const id of [1, 2, 3] as const) await expect(root.getByText(LEVELS[id].label, { exact: true })).toBeVisible();
    await expect(root.locator('input[name="level"][value="2"]')).toBeChecked();
    await expect(root.locator('label.chip')).toHaveText(['Você', 'Computador', 'Sorteio']);
    await expect(root.locator('.field input')).toHaveCount(1);
    await root.locator('label:has(input[name="mode"][value="pvp"])').click();
    await expect(root.getByText(LEVELS[1].label, { exact: true }), 'nível some no modo 2 jogadores').toHaveCount(0);
    await expect(root.locator('label.chip')).toHaveText(['Jogador 1', 'Jogador 2', 'Sorteio']);
    const fields = root.locator('.field input');
    await expect(fields).toHaveCount(2);
    await fields.nth(0).fill('Abcdefghijklmnopqrst');
    await expect(fields.nth(0), 'no máximo 14 caracteres').toHaveValue('Abcdefghijklmn');
    await game.menu({ names: ['  Ana  ', '   '], rules: 'parimpar', breaker: 'p2' });
    const s = await game.state();
    expect(s).toMatchObject({ mode: 'pvp', rules: 'parimpar', names: ['Ana', DEFAULT_SETTINGS.names[1]], breaker: 1 });
  });

  test('SB-RN-02 escolhas lembradas; campos inválidos voltam ao padrão um a um', async ({ game, page }) => {
    await game.start({ mode: 'pvp', rules: 'parimpar', names: ['Ana', 'Bia'], breaker: 'random' });
    expect(JSON.parse((await readStorage(page, CONFIG_KEY))!)).toEqual({ mode: 'pvp', rules: 'parimpar', level: 2, names: ['Ana', 'Bia'], breaker: 'random' });
    await page.getByRole('button', { name: '← Menu' }).click();
    const root = page.locator('.sinuca-de-bar');
    await expect(root.locator('input[name="mode"][value="pvp"]')).toBeChecked();
    await expect(root.locator('input[name="rules"][value="parimpar"]')).toBeChecked();
    await expect(root.locator('input[name="breaker"][value="random"]')).toBeChecked();
    await expect(root.locator('.field input').nth(1)).toHaveValue('Bia');

    // dado gravado com campos inválidos (versão antiga ou editado à mão)
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ mode: 'x', rules: 'parimpar', level: 7, names: ['Zé'], breaker: 'z' })), CONFIG_KEY);
    await page.reload();
    await expect(root.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
    await expect(root.locator('input[name="mode"][value="pvc"]')).toBeChecked();
    await expect(root.locator('input[name="rules"][value="parimpar"]')).toBeChecked();
    await expect(root.locator('input[name="level"][value="2"]')).toBeChecked();
    await expect(root.locator('input[name="breaker"][value="p1"]')).toBeChecked();
    await expect(root.locator('.field input').nth(0)).toHaveValue('Zé');
  });

  test('SB-RN-03 Som liga e desliga e fica gravado', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    const btn = page.getByRole('button', { name: /^Som:/ });
    await expect(btn).toHaveText('Som: desligado');
    await btn.click();
    await expect(btn).toHaveText('Som: ligado');
    expect(await readStorage(page, SOUND_KEY)).toBe('on');
    await btn.click();
    expect(await readStorage(page, SOUND_KEY)).toBe('off');
  });
});
