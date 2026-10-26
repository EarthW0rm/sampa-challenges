import { HubPage } from '../support/hub';
import { ANIM_FRAMES } from './support/page';
import { expect, test } from './support/test';

test.describe('Xadrez Paulistano — bordas', () => {
  test('XP-RN-31 sem pausa na perda de foco; salto de relógio não pula a animação; um laço e um listener no StrictMode', async ({ game, page }) => {
    await game.start({ mode: 'pvc', level: 20, color: 'Brancas' });
    expect(await game.rafPending(), 'um laço vivo (StrictMode)').toBe(1);
    await game.keys(['ArrowUp', 'ArrowUp']);
    expect((await game.state()).cursor, 'uma seta = uma casa (um listener só)').toBe('e2');
    await game.keys(['Enter', 'ArrowUp', 'ArrowUp', 'Enter']);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await game.evidence('Janela perdeu o foco');
    const s = await game.waitComputer();
    expect(s.moves, 'o computador jogou sem foco').toHaveLength(2);

    await game.clickSquare('d2');
    await game.clickSquare('d4', 0);
    await game.jump(60_000);
    await game.frames(1);
    expect((await game.state()).animating, 'quadro gigante limitado: a peça ainda desliza').toBe(true);
    await game.frames(ANIM_FRAMES);
    expect((await game.state()).moves).toHaveLength(3);
    await game.waitComputer();

    await game.press('← Menu');
    expect(await game.rafPending(), 'menu: nenhum laço').toBe(0);
    await game.play();
    expect(await game.rafPending()).toBe(1);
  });

  test('XP-RN-32 armazenamento bloqueado: menu nos padrões, partida e som sem erro', async ({ game, page }) => {
    await game.open({ blockStorage: true });
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvc]')).toBeChecked();
    await game.menu({ mode: 'pvp' });
    await game.play();
    await expect(game.button('Som: ligado'), 'sem storage o som começa ligado').toBeVisible();
    await game.press('Som: ligado');
    await expect(game.button('Som: desligado')).toBeVisible();
    await game.moves(['e2e4', 'e7e5']);
    expect((await game.state()).moves).toEqual(['e4', 'e5']);
    await game.press('← Menu');
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvp]'), 'na mesma visita o menu lembra em memória').toBeChecked();
    await page.reload();
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvc]'), 'recarregada: nada foi gravado').toBeChecked();
  });

  test('XP-RN-33 XP-RN-28 sair pelo hub durante a busca e voltar: menu com as escolhas, partida nova; card sem recorde', async ({ game, page }) => {
    await game.start({ mode: 'pvc', level: 100, color: 'Brancas', names: ['Ana'] });
    await game.clickSquare('e2');
    await game.clickSquare('e4', 20);
    expect((await game.state()).thinking).toBe(true);
    const hub = new HubPage(page, game.ev);
    await hub.back();
    expect(await game.rafPending(), 'jogo desmontado: nenhum laço').toBe(0);
    expect(await game.hasHook(), 'gancho retirado').toBe(false);
    const card = (await hub.cards()).find((c) => c.id === 'xadrez-paulistano');
    expect(card?.record, 'card sem recorde').toBeNull();
    await page.waitForTimeout(3500);
    await hub.openGame('xadrez-paulistano');
    await expect(page.locator('.xadrez-paulistano .level-num')).toHaveText('100');
    await expect(page.locator('.xadrez-paulistano .field input').first()).toHaveValue('Ana');
    await game.play();
    const s = await game.state();
    expect(s.moves).toEqual([]);
    expect(s.thinking).toBe(false);
  });
});
