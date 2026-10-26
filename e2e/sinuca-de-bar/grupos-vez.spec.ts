import { groupOf, RULES } from '../../src/games/sinuca-de-bar/game/rules';
import { expect, test } from './support/test';

test.describe('Sinuca de Bar — grupos e vez', () => {
  test('SB-RN-15 SB-RN-16 ímpares × pares: castigo 15, mesa aberta e a 1ª encaçapada define o grupo', async ({ game }) => {
    await game.start({ mode: 'pvp', rules: 'parimpar', names: ['Ana', 'Bia'] });
    let s = await game.state();
    expect(s.castigo).toBe(RULES.parimpar.castigo);
    const all = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(all.filter((n) => groupOf(n, 'parimpar') === 'A')).toEqual([1, 3, 5, 7, 9, 11, 13]);
    expect(all.filter((n) => groupOf(n, 'parimpar') === 'B')).toEqual([2, 4, 6, 8, 10, 12, 14]);
    // pré-condição rara: fora da saída, mesa aberta, a branca toca a 1 e quem cai é a 4 (par)
    await game.setTable([{ n: 0, x: 199.5, y: 109 }, { n: 1, x: 270.5, y: 149.5 }, { n: 4, x: 282, y: 158 }, { n: 15, x: 60, y: 60 }]);
    s = await game.state();
    expect(s.legal, 'mesa aberta: qualquer uma menos a castigo').toEqual([1, 4]);
    s = await game.shotAt(266.5, 147.5, 50);
    expect(s.lastShot).toMatchObject({ firstHit: 1, pocketed: [4], foul: null, assigned: 'B', again: true });
    expect(s.groups, 'grupo pela bola que caiu, não pela tocada').toEqual(['B', 'A']);
    expect(s.turn).toBe(0);
    expect(s.toasts).toContain('ANA: PARES');
  });

  test('SB-RN-17 sem bola do seu grupo passa a vez e a do adversário fica encaçapada', async ({ game }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    // pré-condição rara: grupos definidos (Ana lisas); a 1 empurra a 9 para a caçapa
    await game.setTable([{ n: 0, x: 199.5, y: 109 }, { n: 1, x: 270.5, y: 149.5 }, { n: 9, x: 282, y: 158 }, { n: 8, x: 60, y: 60 }], { groups: ['A', 'B'] });
    const s = await game.shotAt(266.5, 147.5, 50);
    expect(s.lastShot).toMatchObject({ firstHit: 1, pocketed: [9], foul: null, again: false });
    expect(s).toMatchObject({ turn: 1, ballInHand: null });
    expect(s.balls.find((b) => b.n === 9)!.on).toBe(false);
    expect(s.toasts).toContain('VEZ DE BIA');
  });

  test('SB-RN-18 placar: quem limpa o grupo passa a matar a castigo', async ({ game }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    // pré-condição rara: Ana (lisas) só com a 3 na mesa, na reta da caçapa
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 3, x: 160, y: 60 }, { n: 9, x: 250, y: 150 }, { n: 8, x: 60, y: 160 }], { groups: ['A', 'B'] });
    expect((await game.state()).onCastigo).toEqual([false, false]);
    const s = await game.shotAt(160, 60, 40);
    expect(s.onCastigo).toEqual([true, false]);
    expect(s.legal).toEqual([8]);
    expect(s.toasts).toContain('ANA AGORA MATA A BOLA 8');
    expect(s.turn).toBe(0);
  });
});
