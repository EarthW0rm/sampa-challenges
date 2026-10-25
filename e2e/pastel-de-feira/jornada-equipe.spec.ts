import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { QUEUE_MAX } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test } from './support/game';
import { hire } from './support/staff';

/** Dia 2 só com pastéis (sem caldo): a equipe dá conta de tudo sem a moenda. */
const SEM_CALDO = {
  stock: { massa: 60, carne: 30, mucarela: 30 },
  patch: (c: Campaign): Campaign => ({ ...c, day: 2, calendar: 2, cash: 2000, menu: { ...c.menu, bebidas: [] } }),
};

/** Jornadas do jogo inteiro: equipe completa num dia e a fila com a paciência nova (RN-04, RN-06). */
test.describe('Jornadas', () => {
  test('dia inteiro com Balcão, Montagem e Fritador: a equipe atende sozinha e o fechamento bate com o dia', async ({ game, page }) => {
    test.setTimeout(300_000);
    await game.boot({ campaign: SEM_CALDO });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await hire(game, 'Geral', 'Montagem 1');
    await hire(game, 'Fritador', 'Fritador 1');
    await game.openFair();
    await game.goTo('moenda'); // o pasteleiro fica fora das posições da equipe (JA-01)
    await game.runToEnd();
    const st = await game.lastHook((pf) => ({ served: pf.sim.state.stats.served, burned: pf.sim.state.stats.burned }));
    expect(st.served, 'a equipe atendeu clientes sem o pasteleiro').toBeGreaterThanOrEqual(5);
    expect(st.burned, 'o Fritador nunca queima').toBe(0);
    const row = page.locator('.pastel-de-feira table.summary tr').filter({ has: page.locator('th', { hasText: 'Pedidos atendidos' }) });
    await expect(row.locator('td')).toHaveText(String(st.served));
  });

  test('RN-04/RN-06: sem ninguém anotando, a fila enche, ninguém desiste por paciência e quem chega com ela cheia vai embora', async ({ game }) => {
    await game.startDay();
    await game.goTo('moenda'); // ninguém anota
    await game.advanceUntil((pf) => pf.sim.state.stats.queueFull > 0, 200, undefined, 60);
    const s = await game.hook((pf) => ({
      queue: pf.queue().length,
      lost: pf.sim.state.stats.lostPatience,
      full: pf.sim.state.customers.every((c) => c.patience === c.patienceMax),
    }));
    expect(s.queue).toBe(QUEUE_MAX);
    expect(s.lost, 'antes de anotar, a paciência não conta').toBe(0);
    expect(s.full, 'todos com a paciência cheia').toBe(true);
  });
});
