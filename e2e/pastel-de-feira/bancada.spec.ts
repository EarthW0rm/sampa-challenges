import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test } from './support/game';

/** Cardápio com Carne e Carne Seca (as duas no estoque), para o painel da bancada listar os dois recheios. */
const carneSeca = (c: Campaign): Campaign => ({
  ...c, day: 8, calendar: 8,
  owned: { ...c.owned, items: [...c.owned.items, 'carne-seca'] },
  menu: { ...c.menu, salgados: ['carne', 'queijo', 'carne-seca'] },
  prices: { ...c.prices, 'carne-seca': 15 },
});

/** RN-42 (montar = tocar em cada ingrediente): o jogador precisa distinguir os botões da bancada. */
test.describe('Painel da bancada', () => {
  test('cada ingrediente tem um rótulo próprio (Carne × Carne seca)', async ({ game }) => {
    await game.startDay({
      campaign: { stock: { massa: 30, carne: 15, mucarela: 15, oregano: 10, cana: 10, 'carne-seca': 10, 'queijo-coalho': 10 }, patch: carneSeca },
      storage: { 'pastel-de-feira:visto': JSON.stringify(['equipe', 'associacao', 'delivery', 'tema', 'especial']) },
    });
    await game.goTo('bancada');
    const labels = (await game.controls()).slice(0, 8).map((c) => c.label).filter((l) => !['FECHAR', 'LIMPAR'].includes(l));
    expect(labels.length).toBeGreaterThanOrEqual(4);
    const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dup, `rótulos repetidos no painel da bancada: ${labels.join(', ')}`).toEqual([]);
  });
});
