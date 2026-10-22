import { BALL_R, CY, FOOT_X, HEAD_X, MAX_SPEED, POCKETS } from './constants';
import { type Ball, canPlaceCue, cloneBalls, newEvents, simulate } from './physics';
import { groupOf, legalTargets, type MatchState, resolveShot } from './rules';

/**
 * Computador: monta tacadas candidatas (bola-fantasma de cada bola permitida para cada caçapa,
 * em algumas forças), simula cada uma com a mesma física do jogo, dá nota pelo resultado das
 * regras e escolhe a melhor. A dificuldade entra como erro de mira e de força na hora de bater,
 * menos candidatas e jogo de posição só no nível mais alto.
 */

export type Level = 1 | 2 | 3;

export interface LevelProfile {
  label: string;
  desc: string;
  /** Desvio padrão do erro de mira (graus) e da força (fração). */
  aimNoiseDeg: number;
  powerNoise: number;
  /** Forças testadas em cada linha. */
  powers: number[];
  /** Pensa onde a branca vai parar (próxima tacada). */
  position: boolean;
}

export const LEVELS: Record<Level, LevelProfile> = {
  1: { label: 'Pato', desc: 'Erra bastante a mira e não pensa na próxima.', aimNoiseDeg: 2.2, powerNoise: 0.15, powers: [0.23, 0.4], position: false },
  2: { label: 'Bom de taco', desc: 'Acerta as fáceis e às vezes deixa a branca bem.', aimNoiseDeg: 0.9, powerNoise: 0.07, powers: [0.17, 0.27, 0.4], position: false },
  3: { label: 'Tubarão', desc: 'Quase não erra e já deixa a branca na próxima.', aimNoiseDeg: 0.25, powerNoise: 0.03, powers: [0.13, 0.2, 0.28, 0.4, 0.57], position: true },
};

export interface Shot {
  angle: number;
  power: number;
  /** Onde pôr a branca (só com bola na mão). */
  cue?: { x: number; y: number };
}

interface Line {
  angle: number;
  /** cos do ângulo de corte (1 = bola reta). */
  cut: number;
  dist: number;
}

/** O segmento a→b passa livre (a bola andando nele não encosta em nenhuma das outras)? */
function pathClear(balls: readonly Ball[], ax: number, ay: number, bx: number, by: number, ignore: number[]): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  for (const b of balls) {
    if (!b.on || ignore.includes(b.n)) continue;
    const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / len2));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    if ((b.x - cx) ** 2 + (b.y - cy) ** 2 < (2 * BALL_R - 0.2) ** 2) return false;
  }
  return true;
}

/** Linhas limpas da branca em (cx, cy) até uma das bolas `targets`, para alguma caçapa. */
function lines(balls: readonly Ball[], cx: number, cy: number, targets: number[]): Line[] {
  const out: Line[] = [];
  for (const n of targets) {
    const t = balls.find((b) => b.n === n && b.on);
    if (!t) continue;
    for (const p of POCKETS) {
      const px = p.x - t.x;
      const py = p.y - t.y;
      const pd = Math.hypot(px, py);
      const ux = px / pd;
      const uy = py / pd;
      const gx = t.x - ux * 2 * BALL_R;
      const gy = t.y - uy * 2 * BALL_R;
      const vx = gx - cx;
      const vy = gy - cy;
      const vd = Math.hypot(vx, vy);
      if (vd < 1) continue;
      const cut = (vx * ux + vy * uy) / vd;
      if (cut < 0.25) continue;
      if (!pathClear(balls, cx, cy, gx, gy, [0, n])) continue;
      if (!pathClear(balls, t.x, t.y, p.x, p.y, [0, n])) continue;
      out.push({ angle: Math.atan2(vy, vx), cut, dist: vd + pd });
    }
  }
  return out;
}

function withCue(balls: readonly Ball[], x: number, y: number): Ball[] {
  const sim = cloneBalls(balls);
  const cue = sim.find((b) => b.n === 0)!;
  cue.x = x;
  cue.y = y;
  cue.on = true;
  return sim;
}

/** Nota da posição para quem continua jogando: a melhor linha da próxima tacada. */
function positionScore(balls: readonly Ball[], state: MatchState): number {
  const cue = balls.find((b) => b.n === 0)!;
  if (!cue.on) return 0;
  let best = 0;
  for (const l of lines(balls, cue.x, cue.y, legalTargets(state, balls))) best = Math.max(best, l.cut * 60 - l.dist / 12);
  return best;
}

function evaluate(balls: readonly Ball[], state: MatchState, shot: Shot, profile: LevelProfile): number {
  const start = shot.cue ? withCue(balls, shot.cue.x, shot.cue.y) : cloneBalls(balls);
  const sim = cloneBalls(start);
  const cue = sim.find((b) => b.n === 0)!;
  cue.vx = Math.cos(shot.angle) * shot.power * MAX_SPEED;
  cue.vy = Math.sin(shot.angle) * shot.power * MAX_SPEED;
  const ev = simulate(sim, newEvents());
  const res = resolveShot(state, start, ev);
  const me = state.turn;
  if (res.state.winner === me) return 100000;
  if (res.state.winner !== null) return -100000;
  if (res.foul) return -400;
  const g = res.state.groups[me];
  const own = ev.pocketed.filter((n) => g !== null && groupOf(n, state.rules) === g).length;
  if (res.again) return 300 + 80 * own + (profile.position ? positionScore(sim, res.state) : 0) - shot.power * 10;
  const lost = ev.pocketed.filter((n) => n !== 0).length;
  return -100 - lost * 25;
}

const gauss = (rnd: () => number) => {
  let u = 0;
  for (let i = 0; i < 6; i++) u += rnd();
  return (u - 3) / Math.SQRT1_2 / 1.73;
};

/** Escolhe a tacada do computador (já com o erro do nível). */
export function chooseShot(balls: readonly Ball[], state: MatchState, level: Level, rnd: () => number = Math.random): Shot {
  const profile = LEVELS[level];
  let shot: Shot;
  if (state.isBreak) {
    const y = CY + (rnd() - 0.5) * 30;
    const cue = { x: HEAD_X - 8, y };
    const apex = { x: FOOT_X, y: CY + (rnd() - 0.5) * 2 };
    shot = { angle: Math.atan2(apex.y - y, apex.x - cue.x), power: 1, cue };
  } else {
    shot = bestShot(balls, state, profile, rnd);
  }
  return {
    ...shot,
    angle: shot.angle + (gauss(rnd) * profile.aimNoiseDeg * Math.PI) / 180,
    power: Math.max(0.08, Math.min(1, shot.power * (1 + gauss(rnd) * profile.powerNoise))),
  };
}

function bestShot(balls: readonly Ball[], state: MatchState, profile: LevelProfile, rnd: () => number): Shot {
  const targets = legalTargets(state, balls);
  const candidates: Shot[] = [];
  const cue = balls.find((b) => b.n === 0)!;

  if (state.ballInHand) {
    // bola na mão: põe a branca atrás da bola-fantasma, na reta da caçapa
    const kitchen = state.ballInHand === 'kitchen';
    const spots: { x: number; y: number; score: number }[] = [];
    for (const n of targets) {
      const t = balls.find((b) => b.n === n && b.on)!;
      for (const p of POCKETS) {
        const pd = Math.hypot(p.x - t.x, p.y - t.y);
        const ux = (p.x - t.x) / pd;
        const uy = (p.y - t.y) / pd;
        if (!pathClear(balls, t.x, t.y, p.x, p.y, [0, n])) continue;
        for (const back of [22, 40]) {
          const x = t.x - ux * (2 * BALL_R + back);
          const y = t.y - uy * (2 * BALL_R + back);
          if (!canPlaceCue(balls, x, y, kitchen, HEAD_X)) continue;
          if (!pathClear(balls, x, y, t.x, t.y, [0, n])) continue;
          spots.push({ x, y, score: -(pd + back) });
        }
      }
    }
    spots.sort((a, b) => b.score - a.score);
    for (const s of spots.slice(0, 10)) {
      for (const l of lines(withCue(balls, s.x, s.y), s.x, s.y, targets)) {
        for (const power of profile.powers) candidates.push({ angle: l.angle, power, cue: { x: s.x, y: s.y } });
      }
    }
    if (!candidates.length) {
      const spot = canPlaceCue(balls, cue.x, cue.y, kitchen, HEAD_X) && cue.on ? { x: cue.x, y: cue.y } : freeSpot(balls, kitchen);
      return directShot(balls, targets, spot, profile, state, rnd);
    }
  } else {
    for (const l of lines(balls, cue.x, cue.y, targets)) {
      for (const power of profile.powers) candidates.push({ angle: l.angle, power });
    }
    if (!candidates.length) return directShot(balls, targets, { x: cue.x, y: cue.y }, profile, state, rnd);
  }

  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s = evaluate(balls, state, c, profile) + rnd() * 5;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (bestScore < 0) {
    // nenhuma encaçapa: tenta só encostar numa bola certa sem fazer falta
    const fallback = directShot(balls, targets, best.cue ?? { x: cue.x, y: cue.y }, profile, state, rnd);
    if (evaluate(balls, state, fallback, profile) > bestScore) return fallback;
  }
  return best;
}

/** Sem linha limpa: mira direto (com pequenos desvios) nas bolas permitidas e fica com a melhor. */
function directShot(
  balls: readonly Ball[],
  targets: number[],
  from: { x: number; y: number },
  profile: LevelProfile,
  state: MatchState,
  rnd: () => number,
): Shot {
  const cue = state.ballInHand ? from : undefined;
  let best: Shot = { angle: rnd() * Math.PI * 2, power: 0.5, cue };
  let bestScore = -Infinity;
  for (const n of targets) {
    const t = balls.find((b) => b.n === n && b.on);
    if (!t) continue;
    const base = Math.atan2(t.y - from.y, t.x - from.x);
    for (const off of [0, -0.08, 0.08]) {
      for (const power of [0.4, 0.7]) {
        const shot: Shot = { angle: base + off, power, cue };
        const s = evaluate(balls, state, shot, profile);
        if (s > bestScore) {
          bestScore = s;
          best = shot;
        }
      }
    }
  }
  return best;
}

function freeSpot(balls: readonly Ball[], kitchen: boolean): { x: number; y: number } {
  for (let dx = 0; dx < 60; dx += 4) {
    for (const dy of [0, -12, 12, -24, 24, -36, 36]) {
      const x = HEAD_X - 8 - dx;
      if (canPlaceCue(balls, x, CY + dy, kitchen, HEAD_X)) return { x, y: CY + dy };
    }
  }
  return { x: HEAD_X - 8, y: CY };
}
