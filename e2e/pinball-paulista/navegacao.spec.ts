import { BALLS_PER_GAME } from '../../src/games/pinball-paulista/game/constants';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — telas e navegação', () => {
  test('PP-RN-01 título com Jogar, recorde salvo e início por Enter', async ({ game, page }) => {
    await game.boot({ storage: { 'pinball-paulista:recorde': '4321' } });
    const root = page.locator('.pinball-paulista');
    await expect(root.getByRole('heading', { name: 'PINBALL PAULISTA' })).toBeVisible();
    await expect(root.getByRole('button', { name: 'Jogar' })).toBeFocused();
    await expect(root.locator('.record')).toHaveText('Recorde: 4321');
    await expect(root.getByRole('heading', { name: 'Como jogar' })).toBeVisible();
    await game.pressKey('Enter', 0);
    await game.waitHook();
    await expect(root.locator('canvas')).toBeVisible();
  });

  test('PP-RN-01 sem recorde o título não mostra a linha de recorde; Espaço também começa', async ({ game, page }) => {
    await game.boot();
    await expect(page.locator('.pinball-paulista .record')).toHaveCount(0);
    await game.pressKey('Space', 0);
    await game.waitHook();
    await game.expectPhase('ready');
  });

  test('PP-RN-02 HUD da partida, ← Menu volta ao título e a barra do hub volta à home', async ({ game, page }) => {
    await game.open();
    const root = page.locator('.pinball-paulista');
    const s = await game.state();
    expect(s.phase).toBe('ready');
    expect(s.ball).toBe(1);
    expect(s.balls).toHaveLength(1);
    expect(s.balls[0].rest).toBe(true);
    await expect(root.locator('.ballno')).toHaveText(`Bola 1/${BALLS_PER_GAME}`);
    await expect(root.locator('.helmets img')).toHaveCount(BALLS_PER_GAME);
    await expect(root.locator('.side-right .score')).toHaveText('0');
    await expect(root.locator('.letters b')).toHaveText(['M', 'O', 'T', 'O', 'B', 'O', 'Y']);
    await expect(root.locator('.mult')).toHaveText('×1');
    await expect(root.locator('.hint')).toContainText('Segure ESPAÇO ou LANÇAR e solte');
    await expect(root.getByRole('button', { name: 'Som: não' })).toBeVisible();
    await game.evidence('HUD da partida com a bola na rampa');
    await root.getByRole('button', { name: '← Menu' }).click();
    await expect(root.getByRole('heading', { name: 'PINBALL PAULISTA' })).toBeVisible();
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });

  test('PP-RN-02 gancho só existe na página de teste', async ({ game, page, browser }) => {
    await game.open();
    expect(await game.hasHook()).toBe(true);
    // página sem o relógio de teste (sem a flag __E2E__): o jogo abre e não publica o gancho
    const ctx = await browser.newContext();
    const plain = await ctx.newPage();
    await plain.goto(page.url().replace(/#.*$/, '#/jogos/pinball-paulista'));
    await plain.getByRole('button', { name: 'Jogar' }).click();
    await expect(plain.locator('.pinball-paulista canvas')).toBeVisible();
    expect(await plain.evaluate(() => 'pinball' in window || !!(window as unknown as { __e2e?: unknown }).__e2e)).toBe(false);
    await ctx.close();
  });
});
