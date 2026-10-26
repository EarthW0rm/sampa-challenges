import type { Page } from '@playwright/test';
import { expect, test } from './support/test';

const overDetail = (page: Page) => page.getByRole('dialog', { name: 'Fim de partida' }).locator('p');
const overTitle = (page: Page) => page.getByRole('dialog', { name: 'Fim de partida' }).getByRole('heading');

test.describe('Xadrez Paulistano — xeque e fim de partida', () => {
  test('XP-RN-11 XP-RN-12 XP-RN-28 xeque, só lances que tiram do xeque, mate e o resultado na tela', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    await game.moves(['e2e4', 'f7f6']);
    await game.move('d1', 'h5');
    let s = await game.state();
    expect(s.check).toBe(true);
    expect(s.moves.at(-1)).toBe('Dh5+');
    expect(s.panel.status).toBe('XEQUE!');
    await game.clickSquare('a7');
    expect((await game.state()).legalTargets, 'peão de a7 não tira do xeque').toEqual([]);
    await game.clickSquare('g7');
    expect((await game.state()).legalTargets).toEqual(['g6']);
    await game.clickSquare('g6', 12);
    expect((await game.state()).check).toBe(false);
    await game.move('h5', 'g6');
    s = await game.state();
    expect(s.moves.at(-1)).toBe('Dxg6+');
    // mate de verdade: mate do louco numa partida nova
    await game.press('Nova partida', 'Abandonar esta partida?');
    await game.moves(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    s = await game.state();
    expect(s.outcome).toEqual({ kind: 'checkmate', winner: 1 });
    expect(s.moves.at(-1)).toBe('Dh4#');
    expect(s.panel.status).toBe('XEQUE-MATE!');
    expect(s.panel.boxes.find((b) => b.color === 'b')?.highlighted, 'caixa do vencedor destacada').toBe(true);
    await expect(overTitle(page)).toHaveText('Bia venceu!');
    await expect(overDetail(page)).toHaveText('Xeque-mate das pretas.');
    expect(s.humanTurn, 'depois do fim ninguém joga').toBe(false);
  });

  test('XP-RN-13 XP-RN-14 afogamento e 50 lances (o mate no 100º meio-lance vale)', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara (RN-15): finais montados pelo gancho
    await game.prepareFen('7k/8/6K1/8/8/8/8/5Q2 w - - 0 1');
    await game.move('f1', 'f7');
    expect((await game.state()).outcome).toEqual({ kind: 'stalemate' });
    expect((await game.state()).panel.status).toBe('AFOGADO - EMPATE');
    await expect(overTitle(page)).toHaveText('Empate');
    await expect(overDetail(page)).toHaveText('Afogamento: quem tem a vez não tem lance legal e não está em xeque.');

    await game.prepareFen('7k/8/8/8/8/8/8/R6K w - - 98 80');
    await game.move('a1', 'a2');
    expect((await game.state()).outcome, '99 meios-lances: continua').toBeNull();
    await game.move('h8', 'g8');
    expect((await game.state()).outcome).toEqual({ kind: 'fifty' });
    expect((await game.state()).panel.status).toBe('50 LANCES - EMPATE');
    await expect(overDetail(page)).toHaveText('50 lances de cada lado sem captura nem movimento de peão.');

    await game.prepareFen('7k/8/6K1/8/8/8/8/R7 w - - 99 80');
    await game.move('a1', 'a8');
    expect((await game.state()).outcome).toEqual({ kind: 'checkmate', winner: 0 });
  });

  test('XP-RN-15 repetição tripla jogada da posição inicial', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    await game.moves(['g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect((await game.state()).outcome, 'segunda vez: continua').toBeNull();
    await game.moves(['g1f3', 'g8f6', 'f3g1', 'f6g8']);
    const s = await game.state();
    expect(s.outcome).toEqual({ kind: 'repetition' });
    expect(s.panel.status).toBe('REPETICAO - EMPATE');
    await expect(overDetail(page)).toHaveText('A mesma posição se repetiu três vezes.');
  });

  test('XP-RN-16 material insuficiente: K+B×K e bispos da mesma cor empatam; dois cavalos e bispos de cores diferentes não', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara (RN-15): a captura do último peão decide
    const cases = [
      ['7k/8/8/8/8/8/1p6/B6K w - - 0 1', 'a1', 'b2', 'material'],
      ['7k/8/8/4b3/8/8/1p6/B6K w - - 0 1', 'a1', 'b2', 'material'],
      ['7k/8/8/8/N7/8/1p6/1N5K w - - 0 1', 'a4', 'b2', null],
      ['7k/8/8/5b2/8/8/1p6/B6K w - - 0 1', 'a1', 'b2', null],
    ] as const;
    for (const [fen, from, to, kind] of cases) {
      await game.prepareFen(fen);
      await game.move(from, to);
      const s = await game.state();
      expect(s.outcome?.kind ?? null, fen).toBe(kind);
      if (kind) {
        expect(s.panel.status).toBe('SEM MATE - EMPATE');
        await expect(overDetail(page)).toHaveText('Material insuficiente: ninguém consegue dar xeque-mate.');
      }
    }
  });
});
