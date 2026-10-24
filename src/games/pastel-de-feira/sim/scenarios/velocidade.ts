import { DAY_TICKS, STEP, stepsFor } from '../../game/constants';
import { buildLayout } from '../../game/layout';
import { keyDown, keyStations, keyUp, syncUi, type InputEnv } from '../../game/input';
import { createUi } from '../../game/ui';
import { advance, check, checkEq, hashOf, makeSim, type Scenario, type Scheduled } from '../harness';

/** Rodagem do relógio real: `frames` quadros de 1/60 s na velocidade dada. */
function stepsIn(frames: number, speed: 1 | 2): number {
  let acc = 0;
  let total = 0;
  for (let i = 0; i < frames; i++) {
    const r = stepsFor(acc, 1 / 60, speed);
    acc = r.acc;
    total += r.steps;
  }
  return total;
}

function envOf(seed: number): InputEnv {
  const sim = makeSim(seed);
  sim.state.arrivalLeft = 1e9;
  return { state: sim.state, layout: buildLayout(sim.state.config.stations, { coolers: sim.state.config.coolers }), ui: createUi() };
}

export const velocidade: Scenario[] = [
  {
    id: 'rn173-2x-roda-o-dobro-de-passos',
    rules: 'RN-173',
    run() {
      const um = stepsIn(600, 1);
      const dois = stepsIn(600, 2);
      check(Math.abs(um - 600) <= 1, `1x: ~600 passos em 10 s (obtido ${um})`);
      check(Math.abs(dois - 1200) <= 2, `2x: ~1200 passos em 10 s (obtido ${dois})`);
      // quadro enorme (aba em segundo plano) não pula regras: no máximo 5 passos
      checkEq(stepsFor(0, 5, 2).steps, 5, 'teto de passos por quadro');
    },
  },
  {
    id: 'rn173-equivalencia-1x-2x',
    rules: 'RN-173',
    run(seed) {
      // mesmos comandos por passo => mesmo DayResult, com ou sem o comando de sessão setSpeed
      const sched: Scheduled[] = [
        { tick: 30, cmd: { type: 'tapStation', station: 'bancada' } },
        { tick: 200, cmd: { type: 'tapSlot', station: 'bancada', slot: { k: 'ingrediente', id: 'mucarela' } } },
        { tick: 230, cmd: { type: 'tapSlot', station: 'bancada', slot: { k: 'fechar' } } },
      ];
      const a = makeSim(seed);
      advance(a, DAY_TICKS + 5, sched);
      const b = makeSim(seed);
      b.dispatch({ type: 'setSpeed', speed: 2 });
      advance(b, DAY_TICKS + 5, sched);
      checkEq(b.state.speed, 2, 'velocidade registrada');
      checkEq(hashOf(b.result()), hashOf(a.result()), 'DayResult idêntico');
    },
  },
  {
    id: 'rn174-numeros-vao-as-estacoes',
    rules: 'RN-174',
    run(seed) {
      const env = envOf(seed);
      const ordem = keyStations(env);
      check(ordem.length >= 3, 'estações na ordem da visão geral');
      const r = keyDown(env, 'Digit2', false);
      checkEq(r?.cmds[0]?.type, 'tapStation', 'número vira tapStation');
      checkEq(r?.cmds[0] && 'station' in r.cmds[0] ? r.cmds[0].station : null, ordem[1], 'estação 2');
      checkEq(keyDown(env, 'Digit2', true), null, 'auto-repeat ignorado');
      checkEq(keyDown(env, 'Digit9', false), null, 'número sem estação não faz nada');
    },
  },
  {
    id: 'rn174-espaco-ativa-o-foco-e-esc-recolhe',
    rules: 'RN-174',
    run(seed) {
      const env = envOf(seed);
      env.ui.panel = 'balcao';
      env.ui.focus = 0;
      const r = keyDown(env, 'Space', false);
      check(r !== null && r.cmds.length > 0 && r.cmds[0].type === 'tapSlot', 'Espaço ativa o primeiro controle (anotar)');
      checkEq(keyDown(env, 'Space', true), null, 'auto-repeat não age em dobro');
      keyDown(env, 'ArrowRight', false);
      checkEq(env.ui.focus, 1, 'seta move o foco');
      keyUp(env, 'Space');
      keyDown(env, 'Escape', false);
      checkEq(env.ui.panel, null, 'Esc recolhe o painel');
      syncUi(env, 0.1); // não lança sem painel
    },
  },
  {
    id: 'rn174-p-m-f-sao-de-sessao',
    rules: 'RN-174',
    run(seed) {
      const env = envOf(seed);
      checkEq(keyDown(env, 'KeyP', false)?.session, 'pause', 'P pausa');
      checkEq(keyDown(env, 'KeyM', false)?.session, 'mute', 'M muta');
      checkEq(keyDown(env, 'KeyF', false)?.session, 'speed', 'F acelera');
      checkEq(keyDown(env, 'KeyF', true), null, 'auto-repeat de F ignorado');
      env.state.paused = true;
      checkEq(keyDown(env, 'Digit1', false), null, 'pausado: sem ações de jogo');
      checkEq(STEP > 0, true, 'STEP intacto');
    },
  },
];
