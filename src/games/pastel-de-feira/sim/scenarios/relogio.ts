import { DAY_SECONDS, DAY_TICKS, STEP } from '../../game/constants';
import { DaySim } from '../../game/sim/day';
import type { Command } from '../../game/types';
import { advance, check, checkEq, checkNear, hashOf, makeSim, runDay, type Scenario } from '../harness';

export const relogio: Scenario[] = [
  {
    id: 'rn01-dia-de-240s',
    rules: 'RN-01',
    run(seed) {
      const sim = makeSim(seed);
      advance(sim, DAY_TICKS - 1);
      check(!sim.isOver(), 'o dia ainda não acabou um passo antes');
      checkNear(sim.snapshot().hour, 14, 'hora um passo antes das 14h', 0.01);
      advance(sim, 1);
      check(sim.isOver(), 'o dia acaba no passo 14400');
      checkEq(sim.state.tick, DAY_TICKS, 'passos do dia');
      checkNear(sim.snapshot().t, DAY_SECONDS, 'duração em segundos');
      checkNear(sim.snapshot().hour, 14, 'hora final');
      const antes = sim.state.tick;
      sim.step();
      checkEq(sim.state.tick, antes, 'step depois do corte seco é no-op');
    },
  },
  {
    id: 'rn07-corte-seco-resultado',
    rules: 'RN-07',
    run(seed) {
      const sim = runDay(seed);
      const r = sim.result();
      check(r !== null, 'result() disponível depois do corte seco');
      checkEq(r.ticks, DAY_TICKS, 'ticks no resultado');
      check(sim.drainEvents().some((e) => e.type === 'corte_seco'), 'evento corte_seco emitido');
      checkEq(sim.drainEvents().length, 0, 'drainEvents limpa a fila');
      check(makeSim(seed).result() === null, 'result() é nulo antes do fim');
    },
  },
  {
    id: 'determinismo-mesmo-hash',
    rules: 'spec 5, plan 4.2',
    run(seed) {
      const a = hashOf(runDay(seed).result());
      const b = hashOf(runDay(seed).result());
      checkEq(a, b, 'hash do DayResult com a mesma semente');
    },
  },
  {
    id: 'passo-fixo-exigido',
    rules: 'plan 4.2',
    run(seed) {
      const sim = makeSim(seed);
      let lancou = false;
      try {
        sim.step(0.5);
      } catch {
        lancou = true;
      }
      check(lancou, 'dt diferente de 1/60 lança erro');
      check(Math.abs(STEP - 1 / 60) < 1e-12, 'STEP = 1/60');
    },
  },
  {
    id: 'comando-malformado-descartado',
    rules: 'plan 4.2, spec 4',
    run(seed) {
      const sim = makeSim(seed);
      sim.dispatch({ type: 'naoExiste' } as unknown as Command);
      sim.dispatch({ type: 'tapStation' } as unknown as Command);
      sim.dispatch(null as unknown as Command);
      checkEq(sim.state.rejected, 3, 'comandos malformados contam em rejected');
      checkEq(sim.state.commands.length, 0, 'nada entra na fila');
    },
  },
  {
    id: 'pausa-e-velocidade',
    rules: 'JA-06, RN-173',
    run(seed) {
      const sim: DaySim = makeSim(seed);
      sim.dispatch({ type: 'pause' });
      advance(sim, 100);
      checkEq(sim.state.tick, 0, 'pausado não avança');
      sim.dispatch({ type: 'resume' });
      sim.dispatch({ type: 'setSpeed', speed: 2 });
      advance(sim, 10);
      checkEq(sim.state.tick, 10, 'retomado avança');
      checkEq(sim.snapshot().speed, 2, 'velocidade no snapshot');
    },
  },
  {
    id: 'gesto-processado-uma-vez',
    rules: 'spec 4 (clique duplo)',
    run(seed) {
      const sim = makeSim(seed);
      const cmd: Command = { type: 'tapStation', station: 'bancada', g: 7 };
      sim.dispatch(cmd);
      sim.dispatch(cmd);
      sim.dispatch(cmd);
      sim.step();
      checkEq(sim.state.seenGestures.size, 1, 'gesto registrado uma vez');
    },
  },
];
