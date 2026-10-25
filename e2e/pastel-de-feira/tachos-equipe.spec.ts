import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { OIL_DIRTY_THRESHOLD } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test, type GamePage } from './support/game';
import { assemble, takeOrder } from './support/flow';
import { hire } from './support/staff';

const TACHO = { baskets: 2, oil: 'comum' as const, thermostat: false, alarm: false, timer: false };
/** Dia 2 (equipe liberada), caixa para salários e, com `tachos: 2`, o segundo tacho já comprado (2 m²). */
const day2 = (tachos = 1) => ({
  patch: (c: Campaign): Campaign => ({
    ...c, day: 2, calendar: 2, cash: 2000,
    owned: { ...c.owned, tachos: Array.from({ length: tachos }, () => ({ ...TACHO })), extraM2: (tachos - 1) * 2 },
  }),
});

/** O funcionário aparece dentro da zona da estação `id`? (posição dos pés que o jogo desenha) */
async function workerIn(game: GamePage, id: string): Promise<boolean> {
  const z = await game.zone(id);
  const [w] = await game.hook((pf) => pf.workers());
  return !!w && w.x >= z.x && w.x < z.x + z.w && w.y >= z.y && w.y <= z.y + z.h;
}

/** RN-40, RN-44, RN-45, RN-55a: Montagem, Fritador por tacho e Troca de óleo trabalhando no dia. */
test.describe('Tachos e equipe', () => {
  test('RN-40: a Montagem coloca o pastel montado no primeiro tacho com cesto livre, depois no próximo', async ({ game }) => {
    await game.boot({ campaign: day2(2) });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Montagem 1');
    await game.openFair();
    // o pasteleiro anota os pedidos no balcão; a Montagem monta e coloca sozinha
    await game.advanceUntil((pf) => pf.queue().length >= 3, 120);
    await game.goTo('balcao');
    for (let i = 0; i < 3; i++) await game.tapControl('ANOTAR');
    await game.advanceUntil((pf) => pf.sim.state.tachos[1].baskets.some((b) => b.frying !== null), 60);
    const t1 = await game.hook((pf) => pf.sim.state.tachos[0].baskets.every((b) => b.frying !== null || b.shadow !== null));
    expect(t1, 'o tacho 1 encheu antes de a Montagem usar o tacho 2').toBe(true);
  });

  test('RN-40/JA-01: o Fritador assume o primeiro tacho livre; com o pasteleiro no tacho 1 ele vai para o 2', async ({ game }) => {
    await game.boot({ campaign: day2(2) });
    await game.continueToPrep();
    await hire(game, 'Fritador', 'Fritador 1');
    await game.openFair();
    expect(await workerIn(game, 'tacho1'), 'sem o pasteleiro: Fritador no tacho 1').toBe(true);
    await game.goTo('tacho1');
    await game.frames(2);
    expect(await game.hook((pf) => pf.sim.state.workers[0].position)).toBe('fritador1'); // não sai da posição
    expect(await workerIn(game, 'tacho2'), 'pasteleiro no tacho 1: Fritador no tacho 2').toBe(true);
    await game.goTo('balcao');
    await game.frames(2);
    expect(await workerIn(game, 'tacho1'), 'o pasteleiro saiu: Fritador volta ao tacho 1').toBe(true);
  });

  test('RN-44: o Fritador não monta; coloca o pastel já montado e tira no ponto', async ({ game }) => {
    await game.boot({ campaign: day2() });
    await game.continueToPrep();
    await hire(game, 'Fritador', 'Fritador 1');
    await game.openFair();
    await game.waitCustomer();
    await takeOrder(game);
    await game.advance(10);
    const s = await game.hook((pf) => ({ assembled: pf.sim.state.assembled.length, montar: pf.sim.state.workers.some((w) => w.task?.kind === 'montar') }));
    expect(s, 'sem Montagem, ninguém monta além do pasteleiro').toEqual({ assembled: 0, montar: false });
    const id = await assemble(game, 'carne');
    await game.goTo('balcao'); // o pasteleiro sai da bancada: o Fritador coloca e frita
    await game.advanceUntil((pf, pid) => pf.sim.state.tachos[0].baskets.some((b) => b.frying?.id === pid), 5, id, 1);
    await game.advanceUntil((pf, pid) => pf.sim.state.ready.some((r) => r.id === pid), 20, id);
    expect(await game.hook((pf, pid) => pf.sim.state.ready.find((r) => r.id === pid)!.quality, id)).toBeGreaterThanOrEqual(80);
  });

  test('RN-44/RN-46: o Fritador troca o óleo sujo do tacho dele', async ({ game }) => {
    await game.boot({ campaign: day2() });
    await game.continueToPrep();
    await hire(game, 'Fritador', 'Fritador 1');
    await game.openFair();
    // pré-condição rara: óleo já sujo no início do dia
    await game.hook((pf, d) => {
      pf.sim.state.tachos[0].dirt = d;
    }, OIL_DIRTY_THRESHOLD + 0.05);
    await game.advanceUntil((pf) => pf.sim.state.tachos[0].changeBy === pf.sim.state.workers[0].id, 3, undefined, 1);
    await game.advanceUntil((pf) => pf.sim.state.tachos[0].dirt === 0, 15);
    expect(await game.hook((pf) => pf.sim.state.stats.oilCost)).toBe(25);
  });

  test('RN-45: a Troca de óleo troca o óleo de qualquer tacho', async ({ game }) => {
    await game.boot({ campaign: day2(2) });
    await game.continueToPrep();
    await hire(game, 'Fritador', 'Troca de óleo');
    await game.openFair();
    // pré-condição rara: só o tacho 2 sujo
    await game.hook((pf) => {
      pf.sim.state.tachos[1].dirt = 0.8;
    });
    await game.advanceUntil((pf) => pf.sim.state.tachos[1].changeBy === pf.sim.state.workers[0].id, 3, undefined, 1);
    expect(await workerIn(game, 'tacho2'), 'aparece no tacho que está trocando').toBe(true);
    await game.advanceUntil((pf) => pf.sim.state.tachos[1].dirt === 0, 15);
  });

  test('RN-55a: com o cansaço desligado, a energia da equipe não cai', async ({ game }) => {
    await game.boot({ campaign: { ...day2(), options: { staffFatigue: false } } });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await game.openFair();
    await game.goTo('moenda'); // libera o balcão (JA-01)
    await game.advance(60);
    expect(await game.hook((pf) => ({ e: pf.sim.state.workers[0].energy, rest: pf.sim.state.workers[0].resting }))).toEqual({ e: 100, rest: null });
  });
});
