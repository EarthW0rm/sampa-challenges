import { MOVE_ANIM_S } from '../../src/games/xadrez-paulistano/game/constants';
import { FPS } from '../support/game-page';
import { readStorage } from '../support/storage';
import { expect, test } from './support/test';

/** Atraso do giro automático em quadros: `MOVE_ANIM_S + 0,35 s` depois do lance. */
const FLIP_FRAMES = Math.ceil((MOVE_ANIM_S + 0.35) * FPS) + 2;

test.describe('Xadrez Paulistano — botões da partida', () => {
  test('XP-RN-19 XP-RN-25 Desfazer a dois e giro automático para quem vai jogar (Girar cancela o giro pendente)', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'], autoFlip: true });
    await expect(game.button('Desfazer')).toBeDisabled();
    await game.clickSquare('e2');
    await game.clickSquare('e4', 1);
    expect((await game.state()).flipPending).toBe(true);
    await game.frames(FLIP_FRAMES);
    let s = await game.state();
    expect(s.bottom, 'gira para as pretas').toBe('b');
    expect(s.flipPending).toBe(false);
    await game.move('e7', 'e5');
    await game.frames(FLIP_FRAMES);
    expect((await game.state()).bottom).toBe('w');
    await game.press('Desfazer');
    s = await game.state();
    expect(s.moves).toEqual(['e4']);
    expect(s.bottom, 'Desfazer põe embaixo quem passa a ter a vez').toBe('b');
    // Girar cancela o giro automático pendente
    await game.clickSquare('e7');
    await game.clickSquare('e5', 1);
    await game.press('Girar');
    await game.frames(FLIP_FRAMES);
    s = await game.state();
    expect(s.flipPending).toBe(false);
    expect(s.bottom).toBe('w');
    await expect(page.locator('.xadrez-paulistano .mode-label')).toHaveText('2 jogadores');
  });

  test('XP-RN-20 Desistir: confirmação que expira em 3 s, quem tem a vez perde, Desfazer cancela a desistência', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    await game.move('e2', 'e4');
    await game.press('Desistir');
    await expect(game.button('Confirmar desistência')).toBeVisible();
    // sem o segundo clique, volta ao normal (timer real de 3 s)
    await expect(game.button('Desistir')).toBeVisible({ timeout: 5000 });
    await game.evidence('Confirmação expirou');
    await game.press('Desistir', 'Confirmar desistência');
    const s = await game.state();
    expect(s.outcome).toEqual({ kind: 'resign', winner: 0 });
    expect(s.panel.status).toBe('DESISTENCIA');
    const over = page.getByRole('dialog', { name: 'Fim de partida' });
    await expect(over.getByRole('heading')).toHaveText('Ana venceu!');
    await expect(over.locator('p')).toHaveText('Bia desistiu.');
    await expect(game.button('Desistir')).toBeDisabled();
    await game.press('Ver tabuleiro');
    await game.press('Desfazer');
    const after = await game.state();
    expect(after.outcome).toBeNull();
    expect(after.moves, 'só a desistência foi desfeita').toEqual(['e4']);
  });

  test('XP-RN-21 Nova partida: sem lances recomeça direto; com lances pede confirmação (expira em 3 s); uma confirmação por vez', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.press('Nova partida');
    await expect(game.button('Nova partida'), 'sem lances: sem confirmação').toBeVisible();
    await game.move('e2', 'e4');
    await game.press('Nova partida');
    await expect(game.button('Abandonar esta partida?')).toBeVisible();
    await expect(game.button('Nova partida')).toBeVisible({ timeout: 5000 });
    expect((await game.state()).moves).toEqual(['e4']);
    await game.press('Desistir');
    await game.press('Nova partida');
    await expect(game.button('Abandonar esta partida?')).toBeVisible();
    await expect(game.button('Desistir'), 'a confirmação anterior se desfaz').toBeVisible();
    await game.press('Abandonar esta partida?');
    expect((await game.state()).moves).toEqual([]);
  });

  test('XP-RN-22 XP-RN-23 Girar vira tabuleiro e casas; Som alterna, grava e começa ligado sem nada gravado', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    const before = await game.square('e2');
    await game.press('Girar');
    let s = await game.state();
    expect(s.bottom).toBe('b');
    expect(s.turn, 'a vez não muda').toBe('w');
    const after = await game.square('e2');
    expect(after.y, 'e2 passa para a metade de cima').toBeLessThan(before.y);
    await game.move('e2', 'e4');
    expect((await game.state()).moves).toEqual(['e4']);

    await expect(game.button('Som: desligado')).toBeVisible();
    await game.press('Som: desligado');
    await expect(game.button('Som: ligado')).toBeVisible();
    expect(await readStorage(page, 'xadrez-paulistano:som')).toBe('on');
    await game.press('Som: ligado');
    expect(await readStorage(page, 'xadrez-paulistano:som')).toBe('off');
    // recarrega: vale a escolha gravada; sem nada gravado, começa ligado
    await page.evaluate(() => localStorage.removeItem('xadrez-paulistano:som'));
    await page.reload();
    await game.play();
    await expect(game.button('Som: ligado')).toBeVisible();
    s = await game.state();
    expect(s.moves).toEqual([]);
  });
});
