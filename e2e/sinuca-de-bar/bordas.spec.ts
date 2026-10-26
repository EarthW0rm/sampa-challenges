import { DEFAULT_SETTINGS } from '../../src/games/sinuca-de-bar/game/config';
import { MAX_SPEED } from '../../src/games/sinuca-de-bar/game/constants';
import { CONFIG_KEY } from './support/page';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — bordas', () => {
  test('SB-RN-34 quadro negativo não anda, quadro gigante anda no máximo 0,05 s, foco não pausa e um só laço (StrictMode)', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    expect(await game.rafPending(), 'montagem dupla do StrictMode: um laço só').toBe(1);
    await game.power(100);
    await game.shoot();
    await game.advanceUntil((h) => h.state().phase === 'rolling', 1, undefined, 1);
    const at = async () => (await game.state()).balls[0];
    // relógio volta 1 s: o quadro seguinte tem dt negativo e não anda
    let c0 = await at();
    await game.jump(-1000);
    await game.frames(1);
    let c1 = await at();
    expect(c1.x).toBe(c0.x);
    // aba que volta depois de 10 s: um quadro anda no máximo 0,05 s
    c0 = await at();
    await game.jump(10_000);
    await game.frames(1);
    c1 = await at();
    expect((await game.state()).phase, 'a tacada não terminou num salto').toBe('rolling');
    expect(Math.hypot(c1.x - c0.x, c1.y - c0.y)).toBeLessThanOrEqual(MAX_SPEED * 0.05 + 0.5);
    // perder o foco não pausa: o quadro seguinte continua andando
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    c0 = await at();
    await game.frames(2);
    c1 = await at();
    expect(c1.x).not.toBe(c0.x);
    expect(await game.rafPending()).toBe(1);
  });

  test('SB-RN-34 sair pelo "← Sampa Challenges" no meio da partida desmonta tudo e voltar abre o menu', async ({ game, page }) => {
    await game.start({ mode: 'pvp', rules: 'parimpar' });
    await game.shoot();
    await game.frames(20);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
    expect(await game.rafPending(), 'nenhum laço vivo').toBe(0);
    expect(await game.hasHook(), 'gancho desmontado').toBe(false);
    await page.keyboard.press('ArrowLeft');
    await page.locator('.hub-card a[href="#/jogos/sinuca-de-bar"]').click();
    await expect(page.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
    await expect(page.locator('.sinuca-de-bar input[name="rules"][value="parimpar"]')).toBeChecked();
    await game.menu();
    expect(await game.state()).toMatchObject({ rules: 'parimpar', shots: 0, isBreak: true });
    expect(await game.rafPending()).toBe(1);
  });

  test('SB-RN-35 armazenamento bloqueado: joga com o padrão, som ligado e sem erro', async ({ game, page }) => {
    await game.open({ blockStorage: true });
    const root = page.locator('.sinuca-de-bar');
    await expect(root.locator(`input[name="mode"][value="${DEFAULT_SETTINGS.mode}"]`)).toBeChecked();
    await game.menu({ mode: 'pvp' });
    await expect(page.getByRole('button', { name: /^Som:/ })).toHaveText('Som: ligado');
    await page.getByRole('button', { name: /^Som:/ }).click();
    await expect(page.getByRole('button', { name: /^Som:/ })).toHaveText('Som: desligado');
    const s = await game.shootAndSettle();
    expect(s.shots).toBe(1);
  });

  test('SB-RN-35 SB-RN-02 config corrompida volta ao padrão', async ({ game, page }) => {
    await game.open({ rawStorage: { [CONFIG_KEY]: '{quebrado' } });
    const root = page.locator('.sinuca-de-bar');
    await expect(root.locator('input[name="mode"][value="pvc"]')).toBeChecked();
    await expect(root.locator('input[name="rules"][value="lisas"]')).toBeChecked();
    await expect(root.locator('input[name="level"][value="2"]')).toBeChecked();
    await expect(root.locator('.field input').first()).toHaveValue(DEFAULT_SETTINGS.names[0]);
    await game.menu();
    expect((await game.state()).mode).toBe('pvc');
  });
});
