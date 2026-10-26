/**
 * Piloto da Sinuca de Bar (plan.md 4.3): na vez de uma pessoa, escolhe a tacada com o `chooseShot` do
 * próprio jogo no nível Tubarão sobre o estado lido do gancho e a executa pela tela: arrasta a branca
 * (bola na mão), toca na mesa na direção da mira, ajusta a barra Força e toca em Tacar!. Na vez do
 * computador só deixa o jogo andar. A cada tacada decidida, recalcula o resultado com `resolveShot`
 * (regras do jogo) sobre os eventos da tacada e compara com o que o jogo mostrou.
 */
import { chooseShot, type Shot } from '../../../src/games/sinuca-de-bar/game/ai';
import type { SinucaE2EState } from '../../../src/games/sinuca-de-bar/game/e2eHook';
import type { Ball } from '../../../src/games/sinuca-de-bar/game/physics';
import { mulberry32 } from '../../../src/games/sinuca-de-bar/game/random';
import { resolveShot, type MatchState } from '../../../src/games/sinuca-de-bar/game/rules';
import type { Gesture, Strategy } from '../../support/pilot';
import type { SinucaPage } from './page';

/** Teto da partida: 20 min de jogo. */
export const MAX_FRAMES = 20 * 60 * 60;

const toMatch = (s: SinucaE2EState): MatchState => ({
  rules: s.rules,
  turn: s.turn,
  groups: [...s.groups],
  isBreak: s.isBreak,
  ballInHand: s.ballInHand,
  winner: s.winner,
  endReason: s.endReason,
});

const toBalls = (s: SinucaE2EState): Ball[] => s.balls.map((b) => ({ n: b.n, x: b.x, y: b.y, vx: 0, vy: 0, on: b.on }));

/** Ponto do canvas mais longe da branca na direção `a` (menos erro de arredondamento no toque). */
function farPoint(x: number, y: number, a: number): { x: number; y: number } {
  let t = 1;
  for (let k = 1; k < 400; k++) {
    const px = x + Math.cos(a) * k;
    const py = y + Math.sin(a) * k;
    if (px < 1 || px > 319 || py < 1 || py > 199) break;
    t = k;
  }
  return { x: x + Math.cos(a) * t, y: y + Math.sin(a) * t };
}

export interface SinucaPilotResult {
  tacadas: number;
  /** Tacadas em que o recalculado pelas regras divergiu do jogo. */
  divergencias: string[];
}

export function sinucaStrategy(seed: number): Strategy<SinucaE2EState, SinucaPage> & { stats: SinucaPilotResult } {
  const rnd = mulberry32(seed);
  let plan: Gesture[] = [];
  let planKey = '';
  /** Último retrato com a mesa parada antes de uma tacada. */
  let before: SinucaE2EState | null = null;
  const stats: SinucaPilotResult = { tacadas: 0, divergencias: [] };

  const check = (prev: SinucaE2EState, now: SinucaE2EState) => {
    const l = now.lastShot!;
    const res = resolveShot(toMatch(prev), toBalls(prev), { firstHit: l.firstHit, pocketed: l.pocketed });
    stats.tacadas++;
    const want = { winner: res.state.winner, turn: res.state.winner === null ? res.state.turn : now.turn, groups: res.state.groups, foul: res.foul };
    const got = { winner: now.winner, turn: now.turn, groups: now.groups, foul: l.foul };
    if (JSON.stringify(want) !== JSON.stringify(got)) stats.divergencias.push(`tacada ${now.shots}: regras ${JSON.stringify(want)} × jogo ${JSON.stringify(got)}`);
  };

  return {
    name: 'sinuca-de-bar',
    stats,
    async read(game) {
      // vez do computador: espera a tacada do worker em tempo real, sem rodar quadros (determinismo)
      for (let i = 0; i < 2000; i++) {
        const s = await game.state();
        if (!(s.thinking && s.cpu && !s.cpu.ready)) {
          if (before && s.shots > before.shots) {
            check(before, s);
            before = null;
          }
          if (s.phase === 'aim' && s.winner === null && !s.balls.some((b) => b.moving)) before ??= s;
          return s;
        }
        await game.page.waitForTimeout(5);
      }
      throw new Error('[piloto] o computador não respondeu');
    },
    decide(s) {
      if (s.winner !== null || s.phase !== 'aim' || s.thinking) {
        plan = [];
        return null;
      }
      const key = `${s.shots}:${s.turn}`;
      if (key !== planKey) {
        planKey = key;
        const shot: Shot = chooseShot(toBalls(s), toMatch(s), 3, rnd);
        const cue = s.balls[0];
        const from = shot.cue && s.ballInHand ? shot.cue : { x: cue.x, y: cue.y };
        plan = [];
        if (shot.cue && s.ballInHand && Math.hypot(shot.cue.x - cue.x, shot.cue.y - cue.y) > 0.5) {
          plan.push({ kind: 'drag', from: { x: cue.x, y: cue.y }, to: shot.cue, frames: 6, target: 'branca' });
        }
        const p = farPoint(from.x, from.y, shot.angle);
        plan.push({ kind: 'tap', x: p.x, y: p.y, frames: 1, target: 'mesa (mira)' });
        plan.push({ kind: 'fill', selector: '.sinuca-de-bar input[type="range"]', value: String(Math.max(5, Math.min(100, Math.round(shot.power * 100)))), target: 'barra Força' });
        plan.push({ kind: 'click', selector: '.sinuca-de-bar button.shoot', frames: 1, target: 'Tacar!' });
      }
      return plan.shift() ?? null;
    },
    over: (s) => s.winner !== null,
    result: (s) => ({
      vencedor: s.winner === null ? null : s.names[s.winner],
      motivo: s.endReason,
      vitorias: s.wins,
      tacadas: s.shots,
      recalculadas: stats.tacadas,
      divergencias: stats.divergencias,
    }),
  };
}
