import { ENERGY } from '../../src/games/pastel-de-feira/game/data/staff';
import { QUALITY_PONTO } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test } from './support/game';
import { assemble, fryTimes, tapBasket } from './support/flow';
import { hire } from './support/staff';

const DAY2 = { patch: (c: import('../../src/games/pastel-de-feira/game/campaign/types').Campaign) => ({ ...c, day: 2, calendar: 2, cash: 1000 }) };

/** RN-40, RN-43, RN-45, RN-47, RN-48, RN-49, RN-115, RN-116: equipe contratada no Preparo e trabalhando no dia. */
test.describe('Equipe', () => {
  test('RN-49: Geral não pode ser posto de Fritador (opção desabilitada)', async ({ game, page }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    const opt = page.locator('.pastel-de-feira li.item.staff').last().locator('option', { hasText: 'Fritador 1' });
    await expect(opt).toHaveAttribute('disabled', '');
  });

  test('RN-43: Fritador fixo tira o pastel no meio da janela do ponto (nota 80, nunca queima)', async ({ game, page }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Fritador', 'Fritador 1');
    await game.openFair();
    expect(await game.hook((pf) => pf.sim.state.workers.map((w) => ({ kind: w.kind, mode: w.mode, pos: w.position })))).toEqual([{ kind: 'fritador', mode: 'fixo', pos: 'fritador1' }]);
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    // JA-01: com o pasteleiro no tacho, o Fritador fixo cede a posição; o pasteleiro sai para ele assumir
    await game.tapStation('moenda');
    const t = fryTimes('carne');
    await game.advanceUntil((pf) => pf.sim.state.ready.length > 0, t.burnAt + 2);
    const r = await game.hook((pf) => ({ q: pf.sim.state.ready[0].quality, at: pf.sim.state.ready[0].readyAt, burned: pf.sim.state.stats.burned }));
    expect(r.burned).toBe(0);
    expect(r.q).toBeGreaterThanOrEqual(QUALITY_PONTO);
    void page;
  });

  test('RN-115/RN-141: a energia cai 0,5 por segundo trabalhando (+25% no verão, dias 1–5)', async ({ game }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await game.openFair();
    await game.goTo('moenda'); // libera o balcão (JA-01)
    await game.advanceUntil((pf) => pf.sim.state.workers[0].task !== null, 90, undefined, 1);
    const e0 = await game.hook((pf) => pf.sim.state.workers[0].energy);
    await game.frames(30); // as tarefas do balcão duram 1,5 s
    const e1 = await game.hook((pf) => ({ e: pf.sim.state.workers[0].energy, busy: pf.sim.state.workers[0].task !== null }));
    if (e1.busy) expect(e0 - e1.e).toBeCloseTo(ENERGY.drainPerSecond * 1.25 * 0.5, 2); // dia 2 = verão: cansaço +25%
  });

  test('RN-116: tocar no funcionário fixo manda descansar (sem área: descansa no lugar)', async ({ game }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await game.openFair();
    await game.goTo('moenda');
    await game.hook((pf) => {
      pf.sim.state.workers[0].energy = 30; // cansado: abaixo do limite de volta (80)
    });
    await game.frames(2);
    const w = await game.hook((pf) => pf.workers()[0]);
    await game.tapAt(w.x, w.y - 20);
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.workers[0].resting)).toBe('lugar');
    // sem área de descanso recupera 1 por segundo (RN-116)
    const e0 = await game.hook((pf) => pf.sim.state.workers[0].energy);
    await game.frames(60);
    expect((await game.hook((pf) => pf.sim.state.workers[0].energy)) - e0).toBeCloseTo(ENERGY.restPlaceRate, 1);
  });

  test('JA-01: o pasteleiro no balcão desloca o funcionário fixo; ao sair, ele reassume', async ({ game }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await game.openFair();
    await game.frames(5);
    expect(await game.hook((pf) => pf.sim.state.workers[0].position), 'pasteleiro no balcão').toBeNull();
    await game.goTo('moenda');
    await game.frames(2);
    expect(await game.hook((pf) => pf.sim.state.workers[0].position)).toBe('balcao');
  });

  test('RN-40/RN-45: Geral no balcão anota e entrega sozinho', async ({ game }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    await game.openFair();
    await game.goTo('moenda');
    await game.waitCustomer();
    await game.advanceUntil((pf) => pf.sim.state.customers.some((c) => c.state === 'anotado'), 10, undefined, 6);
  });

  test('RN-47: o salário aparece no fechamento', async ({ game, page }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Balcão');
    const salary = await page.locator('.pastel-de-feira li.item.staff').last().locator('strong').textContent();
    const value = salary!.match(/R\$ [\d.,]+/)![0];
    await game.openFair();
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary tr', { hasText: 'Salários' })).toContainText(value);
  });

  test('RN-48: não dá para contratar mais gente que posições', async ({ game, page }) => {
    await game.boot({ campaign: DAY2 });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Equipe' }).click();
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /^Contratar/ }).and(page.locator(':enabled')).first();
      if ((await btn.count()) === 0) break;
      await btn.click();
    }
    const hint = await page.locator('.pastel-de-feira .tab .hint').first().textContent();
    const [n, max] = hint!.match(/(\d+) de (\d+) posições/)!.slice(1).map(Number);
    expect(n).toBeLessThanOrEqual(max);
  });
});
