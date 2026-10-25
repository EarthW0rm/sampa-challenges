import { HOLD_MILL_MANUAL } from '../../src/games/pastel-de-feira/game/constants';
import { SURPRISE } from '../../src/games/pastel-de-feira/game/data/events';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test, type BootOptions, type GamePage } from './support/game';
import { assemble, mill, tapBasket } from './support/flow';

/** Força o evento surpresa pela chave de depuração do jogo (`Game.tsx`, `withDebug`). */
const forced = (ev: string, extra: BootOptions = {}): BootOptions => ({ ...extra, storage: { ...extra.storage, 'pastel-de-feira:forcar': ev } });
const notices = (game: GamePage) => game.hook((pf) => pf.sim.state.notices.map((n) => n.text));

/** Lê a tabela do fechamento: { rótulo: texto }. */
async function summary(game: GamePage): Promise<Record<string, string>> {
  const rows = game.page.locator('.pastel-de-feira table.summary tr');
  const out: Record<string, string> = {};
  for (let i = 0; i < (await rows.count()); i++) {
    out[(await rows.nth(i).locator('th').textContent())!.trim()] = (await rows.nth(i).locator('td').textContent())!.trim();
  }
  return out;
}

/** RN-152, JA-09, RN-62 (encanto do fiscal), RN-50 (meta com a reputação final). */
test.describe('Eventos surpresa', () => {
  test('Fiscal aprovado: aviso "FISCAL: APROVADO" e +2,0 de encanto', async ({ game }) => {
    await game.startDay(forced('fiscal'));
    await game.advance(30.1);
    expect(await notices(game)).toContain('FISCAL: APROVADO');
    expect(await game.hook((pf) => ({ charm: pf.sim.state.rep.charm, insp: pf.sim.state.stats.inspection }))).toEqual({ charm: 2, insp: 'passed' });
  });

  test('Fiscal com óleo ≥ 70%: multa de R$ 150 no dia', async ({ game }) => {
    await game.startDay(forced('fiscal'));
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 0.75;
    });
    await game.advance(30.1);
    expect(await game.hook((pf) => ({ fines: pf.sim.state.stats.fines, insp: pf.sim.state.stats.inspection }))).toEqual({ fines: SURPRISE.fine, insp: 'failed' });
  });

  test('Fiscal reprovado: a multa aparece no fechamento como multa da fiscalização (não de encomenda)', async ({ game }) => {
    await game.startDay(forced('fiscal'));
    await game.hook((pf) => {
      pf.sim.state.dirt = 65;
    });
    await game.runToEnd();
    const s = await summary(game);
    const line = Object.entries(s).find(([, v]) => v.includes('150,00'));
    expect(line, 'linha da multa de R$ 150').toBeTruthy();
    expect(line![0]).not.toMatch(/encomenda/i);
  });

  test('RN-50/RN-152: a reputação mínima da meta é conferida com a reputação final (já com o −0,3 do fiscal)', async ({ game }) => {
    // dia sem atender ninguém: variação −1,0 (3,0 → 2,0, no limite da meta dos dias 1–5); o fiscal reprova e tira 0,3
    await game.startDay(forced('fiscal'));
    await game.hook((pf) => {
      pf.sim.state.dirt = 65;
    });
    await game.runToEnd();
    const s = await summary(game);
    const after = Number(s['Reputação'].split('→')[1].trim().split(' ')[0].replace(',', '.'));
    const min = Number(s['Reputação mínima'].split(' ')[0].replace(',', '.'));
    expect(after).toBeLessThan(min);
    expect(s['Reputação mínima'], `reputação final ${after} abaixo da mínima ${min} não pode aparecer como cumprida`).toContain('✗');
  });

  test('Queda de energia: a moenda motorizada vira manual (6 s) enquanto falta luz', async ({ game }) => {
    await game.startDay(forced('energia', { campaign: { patch: (c: Campaign) => ({ ...c, owned: { ...c.owned, equip: [...c.owned.equip, 'moenda-motorizada'] } }) } }));
    await game.advance(30.1);
    expect(await game.hook((pf) => pf.sim.state.world.powerLeft)).toBeGreaterThanOrEqual(SURPRISE.energyMin - 0.2);
    await mill(game, 2.5);
    expect(await game.hook((pf) => pf.sim.state.cups.length), 'motorizada sem energia não faz em 2,5 s').toBe(0);
    await mill(game, HOLD_MILL_MANUAL - 2.5);
    expect(await game.hook((pf) => pf.sim.state.cups.length)).toBe(1);
  });

  test('Queda de energia: dura de 20 a 40 s e avisa quando volta', async ({ game }) => {
    await game.startDay(forced('energia'));
    await game.advance(30.1);
    const left = await game.hook((pf) => pf.sim.state.world.powerLeft);
    expect(left).toBeGreaterThanOrEqual(SURPRISE.energyMin - 0.2);
    expect(left).toBeLessThanOrEqual(SURPRISE.energyMax);
    await game.advance(left + 0.1);
    expect(await notices(game)).toContain('ENERGIA VOLTOU');
  });

  test('Excursão: 15 clientes em 20 s e a fila não passa de 6', async ({ game }) => {
    await game.startDay(forced('excursao'));
    await game.advance(30.1);
    const spawned0 = await game.hook((pf) => pf.sim.state.customers.length + pf.sim.state.stats.queueFull + pf.sim.state.stats.lostPrice);
    await game.advance(SURPRISE.excursionSeconds + 0.5);
    const r = await game.hook((pf) => ({ q: pf.queue().length, full: pf.sim.state.stats.queueFull, total: pf.sim.state.customers.length + pf.sim.state.stats.queueFull + pf.sim.state.stats.lostPrice + pf.sim.state.stats.lostPatience }));
    expect(r.q).toBeLessThanOrEqual(6);
    expect(r.full).toBeGreaterThan(0);
    expect(r.total - spawned0).toBeGreaterThanOrEqual(SURPRISE.excursionClients - 1);
  });

  test('Fogo no tacho: óleo ≥ 90% + pastel colocado = tacho parado 20 s, pastel perdido e R$ 80 de reparo', async ({ game, page }) => {
    await game.startDay(forced('fogo'));
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 0.9;
    });
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    const t = await game.hook((pf) => ({ fire: pf.sim.state.tachos[0].fireLeft, frying: pf.sim.state.tachos[0].baskets[0].frying, repairs: pf.sim.state.stats.repairs, burned: pf.sim.state.stats.burned }));
    expect(t.fire).toBeCloseTo(SURPRISE.fireSeconds, 1); // já passou 1 passo desde o fogo
    expect({ ...t, fire: 0 }).toEqual({ fire: 0, frying: null, repairs: SURPRISE.repair, burned: 1 });
    expect(await notices(game)).toContain('FOGO NO TACHO! PARADO POR 20 S');
    // durante o fogo nada entra no tacho
    await assemble(game, 'queijo');
    await game.goTo('tacho1');
    await game.tapControl('CESTO 1');
    expect(await game.hook((pf) => pf.sim.state.tachos[0].baskets[0].frying)).toBeNull();
    await game.runToEnd();
    await expect(page.locator('.pastel-de-feira table.summary tr', { hasText: 'Reparo do tacho' })).toContainText('R$ 80,00');
  });

  test('só 1 evento surpresa por dia (RN-150)', async ({ game }) => {
    await game.startDay(forced('fogo'));
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 0.9;
    });
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    await game.advance(SURPRISE.fireSeconds + 0.5);
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 0.95;
    });
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    expect(await game.hook((pf) => pf.sim.state.tachos[0].fireLeft)).toBe(0);
    expect(await game.hook((pf) => pf.sim.state.world.log)).toEqual(['fogo']);
  });
});
