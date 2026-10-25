import { BROOM_POINTS, CHORINHO_SECONDS, HOLD_BROOM, HOLD_MILL_MANUAL } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test } from './support/game';
import { mill } from './support/flow';

/** RN-42, RN-123, RN-130, RN-132, RN-39a. */
test.describe('Vassoura e moenda', () => {
  test('RN-130: a sujeira da barraca começa o dia em 0', async ({ game }) => {
    await game.startDay();
    expect(await game.hook((pf) => pf.sim.state.dirt)).toBe(0);
  });

  test('RN-132: segurar a vassoura 4 s tira 25 de sujeira', async ({ game }) => {
    await game.startDay();
    await game.hook((pf) => {
      pf.sim.state.dirt = 50;
    });
    await game.goTo('balcao');
    await game.holdControl('VASSOURA', HOLD_BROOM + 0.05);
    expect(await game.hook((pf) => pf.sim.state.dirt)).toBe(50 - BROOM_POINTS);
  });

  test('RN-132: soltar a vassoura antes de 4 s não limpa nada', async ({ game }) => {
    await game.startDay();
    await game.hook((pf) => {
      pf.sim.state.dirt = 50;
    });
    await game.goTo('balcao');
    await game.holdControl('VASSOURA', HOLD_BROOM - 1);
    expect(await game.hook((pf) => pf.sim.state.dirt)).toBe(50);
  });

  test('RN-132: a vassoura não deixa a sujeira negativa', async ({ game }) => {
    await game.startDay();
    await game.hook((pf) => {
      pf.sim.state.dirt = 10;
    });
    await game.goTo('balcao');
    await game.holdControl('VASSOURA', HOLD_BROOM + 0.05);
    expect(await game.hook((pf) => pf.sim.state.dirt)).toBe(0);
  });

  test('RN-42: segurar a moenda 12 s faz 2 caldos', async ({ game }) => {
    await game.startDay();
    await mill(game, 2 * HOLD_MILL_MANUAL);
    expect(await game.hook((pf) => pf.sim.state.cups.length)).toBe(2);
  });

  test('RN-123: chorinho nível 3 soma 0,9 s na extração', async ({ game }) => {
    await game.startDay({ campaign: { patch: (c) => ({ ...c, promo: { ...c.promo, chorinho: 3 } }) } });
    await game.goTo('moenda');
    await game.holdControl('PURO', HOLD_MILL_MANUAL + 0.5);
    expect(await game.hook((pf) => pf.sim.state.cups.length), 'ainda não terminou aos 6,5 s').toBe(0);
    await mill(game, 3 * CHORINHO_SECONDS - 0.5 + 0.05);
    expect(await game.hook((pf) => pf.sim.state.cups.length)).toBe(1);
  });

  test('RN-39a: sem copo o caldo não sai da moenda', async ({ game }) => {
    await game.startDay({ campaign: { consumables: { saquinho: 50 } } });
    await mill(game, HOLD_MILL_MANUAL);
    expect(await game.hook((pf) => pf.sim.state.cups.length)).toBe(0);
  });

  test('RN-33/RN-35: sem cana o caldo sai do cardápio e ninguém pede caldo', async ({ game }) => {
    await game.startDay({ campaign: { stock: { massa: 40, carne: 20, mucarela: 20, oregano: 10 } } });
    await game.advanceUntil((pf) => pf.sim.state.customers.length >= 3, 120);
    const drinks = await game.hook((pf) => pf.sim.state.customers.flatMap((c) => c.lines).filter((l) => l.item.startsWith('caldo')).length);
    expect(drinks).toBe(0);
  });
});
