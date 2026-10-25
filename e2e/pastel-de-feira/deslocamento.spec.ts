import { MOVE_EXTRA_STATION, MOVE_NEIGHBOR } from '../../src/games/pastel-de-feira/game/constants';
import { PANEL_IDLE_SECONDS } from '../../src/games/pastel-de-feira/game/ui';
import { expect, expectSteps, test } from './support/game';

/** RN-41, RN-42, RN-74, spec 4 (clique durante o deslocamento). */
test.describe('Deslocamento do pasteleiro e painel da estação', () => {
  test.beforeEach(async ({ game }) => {
    await game.startDay();
  });

  const arrival = async (game: import('./support/game').GamePage, station: string): Promise<number> => {
    const t0 = await game.tick();
    await game.advanceUntil((pf, s) => pf.sim.state.pasteleiro.to === null && pf.sim.state.pasteleiro.at === s, 5, station, 1);
    return (await game.tick()) - t0;
  };

  test('começa no balcão, parado', async ({ game }) => {
    expect(await game.hook((pf) => ({ at: pf.sim.state.pasteleiro.at, to: pf.sim.state.pasteleiro.to }))).toEqual({ at: 'balcao', to: null });
  });

  test('RN-41: estação vizinha leva 0,4 s', async ({ game }) => {
    await game.tapStation('bancada');
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBe('bancada');
    expectSteps((await arrival(game, 'bancada')) + 1, MOVE_NEIGHBOR * 60, 'balcão → bancada');
  });

  test('RN-41: +0,2 s por estação a mais no caminho (balcão → moenda = 3 estações)', async ({ game }) => {
    await game.tapStation('moenda');
    await game.frames(1);
    expectSteps((await arrival(game, 'moenda')) + 1, (MOVE_NEIGHBOR + 2 * MOVE_EXTRA_STATION) * 60, 'balcão → moenda');
  });

  test('RN-41: o caminho de volta custa o mesmo', async ({ game }) => {
    await game.goTo('tacho1');
    await game.tapStation('balcao');
    await game.frames(1);
    expectSteps((await arrival(game, 'balcao')) + 1, (MOVE_NEIGHBOR + MOVE_EXTRA_STATION) * 60, 'tacho → balcão');
  });

  test('spec 4: clicar durante o deslocamento substitui o destino, sem enfileirar', async ({ game }) => {
    await game.tapStation('moenda');
    await game.frames(10);
    await game.tapStation('bancada');
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBe('bancada');
    await arrival(game, 'bancada');
    await game.frames(60);
    expect(await game.hook((pf) => ({ at: pf.sim.state.pasteleiro.at, to: pf.sim.state.pasteleiro.to }))).toEqual({ at: 'bancada', to: null });
  });

  test('RN-41: ações só valem onde ele está (toque em estação enquanto anda não abre painel)', async ({ game }) => {
    await game.tapStation('tacho1');
    await game.frames(5);
    expect(await game.hook((pf) => pf.env.ui.panel)).toBeNull();
    await arrival(game, 'tacho1');
    await game.frames(1);
    expect(await game.hook((pf) => pf.env.ui.panel)).toBe('tacho1');
  });

  test('RN-74: o painel abre quando ele chega e mostra os controles da estação', async ({ game }) => {
    await game.goTo('balcao');
    const labels = (await game.controls()).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['ANOTAR', 'COBRAR', 'VASSOURA']));
    await game.goTo('tacho1');
    expect((await game.controls()).map((c) => c.label)).toEqual(expect.arrayContaining(['CESTO 1', 'CESTO 2', 'TROCAR OLEO']));
    await game.goTo('moenda');
    expect((await game.controls()).map((c) => c.label)).toEqual(expect.arrayContaining(['PURO', 'COPOS']));
    await game.goTo('bancada');
    expect((await game.controls()).map((c) => c.label)).toEqual(expect.arrayContaining(['FECHAR', 'LIMPAR']));
  });

  test('RN-74: o painel recolhe depois de 4 s sem interação', async ({ game }) => {
    await game.goTo('bancada');
    await game.frames(Math.round((PANEL_IDLE_SECONDS - 0.2) * 60));
    expect(await game.hook((pf) => pf.env.ui.panel)).toBe('bancada');
    await game.frames(Math.round(0.4 * 60));
    expect(await game.hook((pf) => pf.env.ui.panel)).toBeNull();
  });

  test('RN-74: tocar no painel reinicia a contagem de inatividade', async ({ game }) => {
    await game.goTo('bancada');
    await game.frames(3 * 60);
    await game.tapControl('LIMPAR'); // bandeja vazia: o comando é recusado, mas é interação
    await game.frames(3 * 60);
    expect(await game.hook((pf) => pf.env.ui.panel)).toBe('bancada');
  });

  test('RN-74: tocar fora do painel o recolhe', async ({ game }) => {
    await game.goTo('bancada');
    await game.tapAt(320, 4); // faixa de avisos, sem oferta
    await game.frames(1);
    expect(await game.hook((pf) => pf.env.ui.panel)).toBeNull();
  });

  test('RN-74: tocar na estação em que já está reabre o painel sem andar', async ({ game }) => {
    await game.goTo('bancada');
    await game.frames(Math.round((PANEL_IDLE_SECONDS + 0.5) * 60));
    expect(await game.hook((pf) => pf.env.ui.panel)).toBeNull();
    await game.tapStation('bancada');
    await game.frames(1);
    expect(await game.hook((pf) => ({ panel: pf.env.ui.panel, to: pf.sim.state.pasteleiro.to }))).toEqual({ panel: 'bancada', to: null });
  });

  test('sair da estação recolhe o painel dela', async ({ game }) => {
    await game.goTo('bancada');
    await game.tapStation('moenda');
    await game.frames(2);
    expect(await game.hook((pf) => pf.env.ui.panel)).toBeNull();
  });
});
