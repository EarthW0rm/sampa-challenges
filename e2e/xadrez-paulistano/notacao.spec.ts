import { expect, test } from './support/test';

test.describe('Xadrez Paulistano — notação e painel', () => {
  test('XP-RN-17 XP-RN-18 lista em português (captura, roque, desambiguação) e painel com vez, nomes, capturadas e vantagem', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    await expect(page.getByText('As brancas começam.')).toBeVisible();
    let s = await game.state();
    expect(s.panel.status).toBe('VEZ DAS BRANCAS');
    expect(s.panel.boxes).toEqual([
      { color: 'b', name: 'BIA', highlighted: false, material: 0, captured: '' },
      { color: 'w', name: 'ANA', highlighted: true, material: 0, captured: '' },
    ]);
    await game.moves(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6', 'd2d3', 'f8d6', 'e1g1', 'c8g4', 'b1d2']);
    expect(await game.listItems()).toEqual(['1. e4 e5', '2. Cf3 Cc6', '3. Bb5 a6', '4. Bxc6 dxc6', '5. d3 Bd6', '6. O-O Bg4', '7. Cbd2']);
    s = await game.state();
    expect(s.panel.status).toBe('VEZ DAS PRETAS');
    expect(s.panel.boxes[0]).toMatchObject({ color: 'b', highlighted: true, captured: 'b', material: 0 });
    expect(s.panel.boxes[1]).toMatchObject({ color: 'w', highlighted: false, captured: 'n', material: 0 });
    await game.move('g4', 'f3');
    s = await game.state();
    expect(s.moves.at(-1)).toBe('Bxf3');
    expect(s.panel.boxes[0]).toMatchObject({ captured: 'bn', material: 3 });
    // girar troca as caixas de lugar
    await game.press('Girar');
    expect((await game.state()).panel.boxes.map((b) => b.color)).toEqual(['w', 'b']);

    // desambiguação pela fileira (pré-condição rara, RN-15)
    await game.prepareFen('4k3/8/8/8/8/R7/8/R3K3 w - - 0 1');
    await game.move('a1', 'a2');
    expect((await game.state()).moves).toEqual(['T1a2']);
  });
});
