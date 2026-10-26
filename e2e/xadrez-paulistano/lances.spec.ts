import { DRAG_THRESHOLD, SQ } from '../../src/games/xadrez-paulistano/game/constants';
import { ANIM_FRAMES } from './support/page';
import { expect, test } from './support/test';

test.describe('Xadrez Paulistano — lances por clique, arraste e teclado', () => {
  test('XP-RN-02 clique: seleciona, troca, solta, casa inválida e lance', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.clickSquare('e4');
    expect((await game.state()).selected, 'casa vazia sem seleção: nada').toBeNull();
    await game.clickSquare('e7');
    expect((await game.state()).selected, 'peça adversária: nada').toBeNull();
    await game.clickSquare('e2');
    let s = await game.state();
    expect(s.selected).toBe('e2');
    expect(s.legalTargets.sort()).toEqual(['e3', 'e4']);
    await game.clickSquare('d2');
    expect((await game.state()).selected, 'outra peça própria troca a seleção').toBe('d2');
    await game.clickSquare('d2');
    expect((await game.state()).selected, 'clicar de novo solta').toBeNull();
    await game.clickSquare('e2');
    await game.clickSquare('e5');
    s = await game.state();
    expect(s.selected, 'destino ilegal solta').toBeNull();
    expect(s.moves).toEqual([]);
    await game.clickSquare('e2');
    await game.clickSquare('e4', 1);
    expect((await game.state()).animating, 'a peça desliza').toBe(true);
    await game.frames(ANIM_FRAMES);
    s = await game.state();
    expect(s.moves).toEqual(['e4']);
    expect(s.turn).toBe('b');
  });

  test('XP-RN-03 arraste: lance sem animação; fora, ilegal ou de volta devolve a peça e mantém a seleção', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.drag('g1', 'f3');
    let s = await game.state();
    expect(s.moves).toEqual(['Cf3']);
    expect(s.animating, 'arraste joga sem animação').toBe(false);
    await game.drag('b8', 'b5');
    s = await game.state();
    expect(s.moves, 'casa ilegal: volta').toEqual(['Cf3']);
    expect(s.selected).toBe('b8');
    await game.drag('b8', { x: 300, y: 100 });
    s = await game.state();
    expect(s.moves, 'fora do tabuleiro: volta').toEqual(['Cf3']);
    expect(s.selected).toBe('b8');
    // até meia casa + DRAG_THRESHOLD do centro é clique: soltar na própria peça já selecionada a solta
    const c = await game.square('b8');
    expect(SQ / 2 - 2).toBeLessThan(SQ / 2 + DRAG_THRESHOLD);
    await game.drag('b8', { x: c.x + SQ / 2 - 2, y: c.y });
    expect((await game.state()).selected).toBeNull();
    await game.drag('b8', 'c6');
    expect((await game.state()).moves).toEqual(['Cf3', 'Cc6']);
  });

  test('XP-RN-04 teclado: cursor no rei, setas no sentido da tela, Enter/Espaço, Esc, borda e foco em botão', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    await game.keys(['ArrowUp']);
    expect((await game.state()).cursor, '1ª seta: rei de quem tem a vez').toBe('e1');
    await game.keys(['ArrowUp', 'Enter']);
    expect((await game.state()).selected).toBe('e2');
    await game.keys(['ArrowUp', 'ArrowUp', 'Space']);
    await game.frames(ANIM_FRAMES);
    expect((await game.state()).moves).toEqual(['e4']);
    await game.keys(['ArrowUp', 'ArrowUp', 'ArrowUp', 'Enter']);
    expect((await game.state()).selected).toBe('e7');
    await game.keys(['Escape']);
    expect((await game.state()).selected, 'Esc solta').toBeNull();
    await game.keys(['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
    expect((await game.state()).cursor, 'para na borda').toBe('a7');
    // tabuleiro girado: ↑ anda para a 1ª fileira; com foco no botão, Enter aciona o botão
    await game.press('Girar');
    await game.keys(['ArrowUp']);
    let s = await game.state();
    expect(s.bottom).toBe('b');
    expect(s.cursor).toBe('a6');
    await game.ev.quiet(() => page.keyboard.press('Enter'));
    await game.frames(1);
    await game.ev.action('Tecla Enter com foco no botão Girar');
    s = await game.state();
    expect(s.bottom, 'Enter acionou o Girar').toBe('w');
    expect(s.selected).toBeNull();
    await game.clickSquare('h7');
    s = await game.state();
    expect(s.cursor, 'clique esconde o cursor').toBeNull();
    expect(s.selected).toBe('h7');
  });

  test('XP-RN-05 só a cor da vez move; entrada parada durante a animação', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    await game.clickSquare('d7');
    expect((await game.state()).selected).toBeNull();
    await game.clickSquare('e2');
    await game.clickSquare('e4', 1);
    expect((await game.state()).humanTurn).toBe(false);
    await game.clickSquare('d7');
    expect((await game.state()).selected, 'durante a animação: ignorado').toBeNull();
    await game.frames(ANIM_FRAMES);
    await game.clickSquare('d7');
    expect((await game.state()).selected).toBe('d7');
    await game.clickSquare('e4');
    expect((await game.state()).selected, 'peça adversária sem lance legal: solta').toBeNull();
  });
});
