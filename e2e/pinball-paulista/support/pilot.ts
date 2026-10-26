/**
 * Piloto do Pinball Paulista (plan.md 4.3): bola descendo na zona de um flipper → aperta aquele flipper;
 * bola parada na rampa → segura Espaço PLUNGER_CHARGE_TIME e solta. Só teclado (Z, /, Espaço).
 */
import { FLIPPER_PIVOT_L, FLIPPER_PIVOT_R, PLUNGER_CHARGE_TIME } from '../../../src/games/pinball-paulista/game/constants';
import type { PinballE2EState } from '../../../src/games/pinball-paulista/game/e2eHook';
import type { Gesture, Strategy } from '../../support/pilot';
import { tallyTotal } from './rules';
import type { PinballPage } from './page';

/** Teto da partida: 30 min de jogo. */
export const MAX_FRAMES = 30 * 60 * 60;
/** Quadros entre leituras quando o piloto não age. */
export const DECIDE_EVERY = 2;

const CENTER = (FLIPPER_PIVOT_L.x + FLIPPER_PIVOT_R.x) / 2;
const LAUNCH_FRAMES = Math.round(PLUNGER_CHARGE_TIME * 60);
/** Faixa de altura em que a bola está ao alcance do flipper. */
const ZONE_TOP = FLIPPER_PIVOT_L.y - 34;
const ZONE_BOTTOM = FLIPPER_PIVOT_L.y + 14;

/** Bola encostada no pivô: ali o flipper não tem velocidade; melhor soltar e deixá-la rolar para a ponta. */
const nearPivot = (b: { x: number; y: number }): boolean =>
  Math.hypot(b.x - FLIPPER_PIVOT_L.x, b.y - FLIPPER_PIVOT_L.y) < 9 || Math.hypot(b.x - FLIPPER_PIVOT_R.x, b.y - FLIPPER_PIVOT_R.y) < 9;

export function pinballStrategy(): Strategy<PinballE2EState, PinballPage> {
  return {
    name: 'pinball-paulista',
    read: (g) => g.state(),
    decide: (s): Gesture | null => {
      if (s.phase !== 'ready' && s.phase !== 'play') return null;
      // soltou Espaço e nenhum quadro rodou ainda: a mola dispara no próximo quadro
      if (s.charge > 0) return { kind: 'wait', frames: 2, target: 'lançador' };
      if (s.balls.some((b) => b.rest)) return { kind: 'key', key: 'Space', frames: LAUNCH_FRAMES, target: 'lançador' };
      if (s.tilt) return null;
      const ball = s.balls
        .filter((b) => b.held <= 0 && b.vy > 20 && b.y > ZONE_TOP && b.y < ZONE_BOTTOM && b.x < 214 && !nearPivot(b))
        .sort((a, b) => b.y - a.y)[0];
      if (!ball) return null;
      return ball.x < CENTER
        ? { kind: 'key', key: 'z', frames: 8, target: 'flipper esquerdo' }
        : { kind: 'key', key: '/', frames: 8, target: 'flipper direito' };
    },
    over: (s) => s.phase === 'over',
    result: (s) => ({
      placar: s.score,
      recalculado: tallyTotal(s.tally),
      bolas: s.ball,
      bonus: s.bonusLog,
      eventos: s.tally,
      recorde: s.record,
      novoRecorde: s.newRecord,
    }),
  };
}
