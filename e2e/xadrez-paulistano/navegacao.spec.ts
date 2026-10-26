import { expect, test } from './support/test';

/** Mate do louco: as pretas dão mate no 2º lance. */
const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

test.describe('Xadrez Paulistano — telas e navegação', () => {
  test('XP-RN-01 menu → partida → fim (Jogar de novo, Ver tabuleiro, Menu) → ← Menu → hub', async ({ game, page }) => {
    await game.open();
    await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
    await game.menu({ mode: 'pvp', names: ['Ana', 'Bia'] });
    await game.play();
    const s0 = await game.state();
    expect(s0.mode).toBe('pvp');
    expect(s0.names).toEqual(['Ana', 'Bia']);
    await expect(page.locator('.xadrez-paulistano .mode-label')).toHaveText('2 jogadores');
    await expect(page.getByText('As brancas começam.')).toBeVisible();

    await game.moves(FOOLS_MATE);
    const over = page.getByRole('dialog', { name: 'Fim de partida' });
    await expect(over).toBeVisible();
    await expect(over.getByRole('heading')).toHaveText('Bia venceu!');
    // Ver tabuleiro fecha a janela; a partida continua parada
    await game.press('Ver tabuleiro');
    await expect(over).toBeHidden();
    expect((await game.state()).outcome?.kind).toBe('checkmate');
    // Desfazer reabre e o mate de novo traz a janela; Jogar de novo recomeça com as mesmas escolhas
    await game.press('Desfazer');
    await game.move('d8', 'h4');
    await expect(over).toBeVisible();
    await game.press('Jogar de novo');
    await expect(over).toBeHidden();
    expect((await game.state()).moves).toEqual([]);
    expect((await game.state()).names).toEqual(['Ana', 'Bia']);

    // Menu (janela de fim) volta ao menu com as escolhas marcadas
    await game.moves(FOOLS_MATE);
    await game.press('Menu');
    await expect(page.getByRole('heading', { name: 'XADREZ PAULISTANO' })).toBeVisible();
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvp]')).toBeChecked();
    await expect(page.locator('.xadrez-paulistano .field input').first()).toHaveValue('Ana');

    // ← Menu da barra também volta; a partida não é salva
    await game.play();
    await game.move('e2', 'e4');
    await game.press('← Menu');
    await expect(page.getByRole('heading', { name: 'XADREZ PAULISTANO' })).toBeVisible();
    await game.play();
    expect((await game.state()).moves).toEqual([]);

    await game.ev.quiet(() => page.getByRole('link', { name: '← Sampa Challenges' }).click());
    await expect(page.locator('.hub-home')).toBeVisible();
    await game.ev.action('Clique em "← Sampa Challenges"');
  });
});
