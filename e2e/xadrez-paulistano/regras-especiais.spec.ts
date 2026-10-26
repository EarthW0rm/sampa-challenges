import { expect, test } from './support/test';

test.describe('Xadrez Paulistano — regras especiais', () => {
  test('XP-RN-06 XP-RN-07 movimento das peças e roque longo/curto jogados da posição inicial', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.clickSquare('b1');
    expect((await game.state()).legalTargets.sort()).toEqual(['a3', 'c3']);
    await game.clickSquare('e2');
    expect((await game.state()).legalTargets.sort()).toEqual(['e3', 'e4']);
    await game.clickSquare('e2');
    // brancas: roque longo (e1 → c1); pretas: roque curto (e8 → g8)
    await game.moves(['d2d4', 'd7d5', 'b1c3', 'g8f6', 'c1f4', 'e7e6', 'd1d2', 'f8e7']);
    await game.clickSquare('e1');
    expect((await game.state()).legalTargets).toContain('c1');
    await game.clickSquare('c1', 12);
    await game.move('e8', 'g8');
    const s = await game.state();
    expect(s.moves.slice(-2)).toEqual(['O-O-O', 'O-O']);
    // torre do lado da dama em d1, torre do lado do rei em f8
    expect(s.fen.split(' ')[0]).toBe('rnbq1rk1/ppp1bppp/4pn2/3p4/3P1B2/2N5/PPPQPPPP/2KR1BNR');
  });

  test('XP-RN-07 XP-RN-08 roque proibido: casa atacada, rei em xeque, direito perdido; b1 atacada não impede', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara (RN-15): posições de roque montadas pelo gancho
    await game.prepareFen('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
    await game.clickSquare('e1');
    let t = (await game.state()).legalTargets;
    expect(t, 'f1 atacada: sem roque curto').not.toContain('g1');
    expect(t, 'roque longo continua').toContain('c1');

    await game.prepareFen('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    await game.clickSquare('e1');
    t = (await game.state()).legalTargets;
    expect(t, 'rei em xeque: nenhum roque').not.toContain('g1');
    expect(t).not.toContain('c1');

    await game.prepareFen('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    await game.clickSquare('e1');
    t = (await game.state()).legalTargets;
    expect(t, 'b1 atacada não impede o roque longo').toContain('c1');
    expect(t).toContain('g1');
    await game.clickSquare('e1');

    // o rei vai e volta: perde os dois roques
    await game.prepareFen('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    await game.moves(['e1f1', 'e8d8', 'f1e1', 'd8e8']);
    await game.clickSquare('e1');
    t = (await game.state()).legalTargets;
    expect(t).not.toContain('g1');
    expect(t).not.toContain('c1');
  });

  test('XP-RN-09 en passant só no lance seguinte, jogado da posição inicial', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.moves(['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    await game.clickSquare('e5');
    expect((await game.state()).legalTargets.sort()).toEqual(['d6', 'e6']);
    await game.clickSquare('d6', 12);
    const s = await game.state();
    expect(s.moves.at(-1)).toBe('exd6');
    expect(s.fen.split(' ')[0], 'o peão de d5 saiu do tabuleiro').toBe('rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR');

    // sem aproveitar na hora, o direito acaba
    await game.press('Nova partida', 'Abandonar esta partida?');
    await game.moves(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'h7h6']);
    await game.clickSquare('e5');
    expect((await game.state()).legalTargets).toEqual(['e6']);
  });

  test('XP-RN-10 promoção com escolha: jogada da posição inicial e nas 4 peças; Cancelar devolve o peão', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    await game.moves(['h2h4', 'g7g5', 'h4g5', 'f8g7', 'g5g6', 'g8f6', 'g6h7', 'h8g8']);
    await game.clickSquare('h7');
    await game.clickSquare('g8');
    const dialog = page.getByRole('dialog', { name: 'Promoção do peão' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button')).toHaveText(['Dama', 'Torre', 'Bispo', 'Cavalo', 'Cancelar']);
    let s = await game.state();
    expect(s.promotion).toEqual({ color: 'w', from: 'h7', to: 'g8' });
    expect(s.panel.status).toBe('ESCOLHA A PECA');
    expect(s.humanTurn, 'tabuleiro parado na promoção').toBe(false);
    await game.promote('Dama');
    s = await game.state();
    expect(s.moves.at(-1)).toBe('hxg8=D+');
    expect(s.fen.split(' ')[0].startsWith('rnbqk1Q1')).toBe(true);

    // pré-condição rara (RN-15): peão na 7ª para escolher cada peça
    const pieces = [
      ['Dama', 'Q', 'a8=D'],
      ['Torre', 'R', 'a8=T'],
      ['Bispo', 'B', 'a8=B'],
      ['Cavalo', 'N', 'a8=C'],
    ] as const;
    for (const [label, letter, san] of pieces) {
      await game.prepareFen('8/P6k/7p/8/8/8/8/K7 w - - 0 1');
      await game.move('a7', 'a8');
      await game.promote(label);
      s = await game.state();
      expect(s.fen.split(' ')[0].startsWith(letter), label).toBe(true);
      expect(s.moves).toEqual([san]);
    }

    await game.prepareFen('8/P6k/7p/8/8/8/8/K7 w - - 0 1');
    await game.move('a7', 'a8');
    await game.promote('Cancelar');
    s = await game.state();
    expect(s.promotion).toBeNull();
    expect(s.selected).toBeNull();
    expect(s.fen.split(' ')[0]).toBe('8/P6k/7p/8/8/8/8/K7');
    expect(s.turn).toBe('w');
  });
});
