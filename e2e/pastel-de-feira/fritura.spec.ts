import {
  DIRT_PER_BURNED, DIRT_PER_OIL_CHANGE, HOLD_OIL_MANUAL, OIL_CHANGE_COST, OIL_DIRTY_QUALITY_PENALTY, QUALITY_OVERDONE, QUALITY_PONTO, QUALITY_RAW,
} from '../../src/games/pastel-de-feira/game/constants';
import { expect, test, type GamePage } from './support/game';
import { assemble, fry, fryTimes, fryingSeconds, tapBasket } from './support/flow';

const CARNE = fryTimes('carne'); // ponto 5–8 s, queima aos 10 s (RN-30)

/** RN-23, RN-24, RN-42, RN-46, RN-131, spec 4 (queimado, óleo 100%). */
test.describe('Tacho: fritura, ponto e óleo', () => {
  test.beforeEach(async ({ game }) => {
    await game.startDay();
  });

  test('RN-30: carne tem ponto de 5 a 8 s e queima aos 10 s', () => {
    expect(CARNE).toEqual({ ponto: [5, 8], burnAt: 10 });
  });

  test('RN-23: tirado cru (antes do ponto) sai com nota 40', async ({ game }) => {
    await assemble(game, 'carne');
    const p = await fry(game, CARNE.ponto[0] - 1);
    expect(p.quality).toBe(QUALITY_RAW);
  });

  test('RN-23: tirado no início da janela do ponto sai com nota 80', async ({ game }) => {
    await assemble(game, 'carne');
    const p = await fry(game, CARNE.ponto[0] + 0.1);
    expect(p.quality).toBe(QUALITY_PONTO);
  });

  test('RN-23: tirado no fim da janela do ponto ainda é 80', async ({ game }) => {
    await assemble(game, 'carne');
    const p = await fry(game, CARNE.ponto[1] - 0.1);
    expect(p.quality).toBe(QUALITY_PONTO);
  });

  test('RN-23: tirado passado (depois do ponto, antes de queimar) sai com nota 55', async ({ game }) => {
    await assemble(game, 'carne');
    const p = await fry(game, (CARNE.ponto[1] + CARNE.burnAt) / 2);
    expect(p.quality).toBe(QUALITY_OVERDONE);
  });

  test('spec 4/RN-23: queimado não vira pronto, o cesto fica bloqueado até tirar e a barraca suja +3', async ({ game }) => {
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    await game.frames(Math.round((CARNE.burnAt + 0.5) * 60));
    const burned = await game.hook((pf) => pf.sim.state.tachos[0].baskets[0].frying?.burned);
    expect(burned).toBe(true);
    // a fritura para no queimado (o contador não segue)
    const s1 = await fryingSeconds(game);
    await game.frames(60);
    expect(await fryingSeconds(game)).toBe(s1);
    // cesto bloqueado: montar outro e tentar colocar no mesmo cesto tira o queimado em vez de colocar
    const dirt0 = await game.hook((pf) => pf.sim.state.dirt);
    await game.goTo('tacho1');
    await game.tapControl('CESTO 1');
    const r = await game.hook((pf) => ({ ready: pf.sim.state.ready.length, burned: pf.sim.state.stats.burned, free: pf.sim.state.tachos[0].baskets[0].frying === null, dirt: pf.sim.state.dirt }));
    expect(r).toEqual({ ready: 0, burned: 1, free: true, dirt: dirt0 + DIRT_PER_BURNED });
  });

  test('RN-24: óleo sujo (≥ 70%) tira 15 pontos da nota', async ({ game }) => {
    // prepara o óleo em 68%: o próximo pastel leva a 72% (sujo)
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 0.68;
    });
    await assemble(game, 'carne');
    const p = await fry(game, (CARNE.ponto[0] + CARNE.ponto[1]) / 2);
    expect(p.quality).toBe(QUALITY_PONTO - OIL_DIRTY_QUALITY_PENALTY);
  });

  test('spec 4/RN-46: óleo em 100% trava o tacho; nada novo entra até a troca', async ({ game }) => {
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 1;
    });
    await assemble(game, 'carne');
    await game.goTo('tacho1');
    await game.tapControl('CESTO 1');
    expect(await game.hook((pf) => ({ f: pf.sim.state.tachos[0].baskets[0].frying, a: pf.sim.state.assembled.length }))).toEqual({ f: null, a: 1 });
    const ctl = await game.findControl('TROCAR OLEO');
    expect(ctl.sub).toBe('TRAVADO');
  });

  const dirtyTacho = async (game: GamePage, dirt: number) => {
    await game.hook((pf, d) => {
      pf.sim.state.tachos[0].dirt = d;
    }, dirt);
  };

  test('RN-42/RN-46: segurar TROCAR OLEO por 8 s zera o óleo, custa R$ 25 e suja a barraca +5', async ({ game }) => {
    await dirtyTacho(game, 0.8);
    await game.goTo('tacho1');
    await game.holdControl('TROCAR OLEO', HOLD_OIL_MANUAL + 0.05);
    const r = await game.hook((pf) => ({ dirt: pf.sim.state.tachos[0].dirt, cost: pf.sim.state.stats.oilCost, barraca: pf.sim.state.dirt, hold: pf.sim.state.pasteleiro.hold }));
    expect(r).toEqual({ dirt: 0, cost: OIL_CHANGE_COST, barraca: DIRT_PER_OIL_CHANGE, hold: null });
  });

  test('RN-42: soltar antes dos 8 s cancela a troca sem custo', async ({ game }) => {
    await dirtyTacho(game, 0.8);
    await game.goTo('tacho1');
    await game.holdControl('TROCAR OLEO', HOLD_OIL_MANUAL / 2);
    const r = await game.hook((pf) => ({ dirt: pf.sim.state.tachos[0].dirt, cost: pf.sim.state.stats.oilCost, progress: pf.sim.state.tachos[0].changeProgress }));
    expect(r).toEqual({ dirt: 0.8, cost: 0, progress: 0 });
  });

  test('RN-46: durante a troca o tacho fica parado (a fritura não avança)', async ({ game }) => {
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    await game.frames(60);
    const s0 = await fryingSeconds(game);
    const p = await game.findControl('TROCAR OLEO');
    const pt = await game.toClient(p.x + p.w / 2, p.y + p.h / 2);
    await game.page.mouse.move(pt.x, pt.y);
    await game.page.mouse.down();
    await game.frames(120);
    const during = await fryingSeconds(game);
    await game.page.mouse.up();
    expect(during).toBeCloseTo(s0!, 1);
  });

  test('RN-46: 18 pastéis seguidos levam o óleo a 72% (sujo) e o painel avisa', async ({ game }) => {
    await game.hook((pf) => {
      pf.sim.state.tachos[0].dirt = 0.68;
    });
    await assemble(game, 'carne');
    await tapBasket(game, 0);
    const ctl = await game.findControl('TROCAR OLEO');
    expect(ctl.sub).toBe('72%');
  });

  test('sair do tacho no meio da troca cancela a troca', async ({ game }) => {
    await dirtyTacho(game, 0.8);
    await game.goTo('tacho1');
    const p = await game.findControl('TROCAR OLEO');
    const pt = await game.toClient(p.x + p.w / 2, p.y + p.h / 2);
    await game.page.mouse.move(pt.x, pt.y);
    await game.page.mouse.down();
    await game.frames(120);
    await game.page.mouse.up();
    await game.tapStation('bancada');
    await game.frames(60);
    expect(await game.hook((pf) => ({ p: pf.sim.state.tachos[0].changeProgress, d: pf.sim.state.tachos[0].dirt }))).toEqual({ p: 0, d: 0.8 });
  });
});
