import { SUBSTEPS_PER_SECOND } from '../../src/games/capacete-voador/game/constants';
import { HubPage } from '../support/hub';
import { expect, test } from './support/test';

test.describe('Capacete Voador — bordas', () => {
  test('CV-RN-34 quadro gigante (aba que volta) avança no máximo 100 ms do voo', async ({ game }) => {
    await game.play({ mode: 'practice' });
    await game.aim(80, 120);
    await game.fire();
    await game.frames(2);
    const before = (await game.state()).flight!.step;
    await game.jump(60_000);
    await game.frames(1);
    const s = await game.state();
    expect(s.flight, 'o capacete não pulou o voo inteiro').not.toBeNull();
    const max = Math.round((100 / 1000) * SUBSTEPS_PER_SECOND);
    expect(s.flight!.step - before).toBeLessThanOrEqual(max + 1);
    expect(s.flight!.step - before).toBeGreaterThanOrEqual(max - 1);
    await game.waitShot();
  });

  test('CV-RN-34 perda de foco não pausa: a mira espera, o voo continua', async ({ game, page }) => {
    await game.play({ mode: 'practice' });
    const blur = () => page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await blur();
    await game.frames(300);
    let s = await game.state();
    expect(s.phase, 'na mira nada anda').toBe('aiming');
    expect(s.shotsFired).toBe(0);
    await game.aim(70, 90);
    await game.fire();
    const step = (await game.state()).flight!.step;
    await blur();
    await game.frames(10);
    s = await game.state();
    expect(s.flight!.step, 'o voo continua sem foco').toBeGreaterThan(step);
    await game.waitShot();
  });

  test('CV-RN-34 armazenamento bloqueado: joga, som ligado e alternar não quebra', async ({ game, page }) => {
    await game.play({ mode: 'practice' }, { blockStorage: true });
    const btn = page.getByRole('button', { name: /^Som:/ });
    await expect(btn, 'sem storage, som ligado').toHaveText('Som: ligado');
    await btn.click();
    await expect(btn).toHaveText('Som: desligado');
    const s = await game.passTurn(0);
    expect(s.shotsFired).toBe(1);
  });

  test('CV-RN-32 CV-RN-33 valor de som desconhecido conta como ligado; o jogo só grava o som', async ({ game, page }) => {
    await game.play({ mode: 'pvp' }, { rawStorage: { 'capacete-voador:som': '{corrompido' } });
    await expect(page.getByRole('button', { name: /^Som:/ })).toHaveText('Som: ligado');
    await game.passTurn(0);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('capacete-voador')));
    expect(keys).toEqual(['capacete-voador:som']);
  });

  test('CV-RN-34 StrictMode: um laço de quadros só, também depois de ← Menu, Jogar e Reiniciar', async ({ game }) => {
    await game.play();
    expect(await game.rafPending()).toBe(1);
    await game.restart();
    expect(await game.rafPending()).toBe(1);
    await game.backToMenu();
    expect(await game.rafPending(), 'menu sem laço').toBe(0);
    expect(await game.hasHook()).toBe(false);
    await game.start();
    expect(await game.rafPending()).toBe(1);
  });

  test('CV-RN-33 CV-RN-34 sair pelo hub no meio do voo e voltar abre o menu com os padrões, sem recorde no card', async ({ game, page }) => {
    await game.play({ mode: 'pvp', names: ['Ana', 'Bia'], points: 7 });
    await game.aim(80, 150);
    await game.fire();
    await game.frames(10);
    expect((await game.state()).flight).not.toBeNull();
    const hub = new HubPage(page, game.ev);
    await hub.back();
    expect(await game.rafPending(), 'laço cancelado').toBe(0);
    expect(await game.hasHook(), 'gancho removido').toBe(false);
    const card = (await hub.cards()).find((c) => c.id === 'capacete-voador')!;
    expect(card.record, 'o jogo não tem recorde').toBeNull();
    await hub.openGame('capacete-voador');
    await expect(page.locator('.capacete-voador .card', { hasText: 'Contra o computador' })).toHaveClass(/selected/);
    await expect(page.getByLabel('Nome do jogador 1')).toHaveValue('Jogador 1');
    await expect(page.getByLabel('Pontos para vencer')).toHaveValue('3');
  });
});
