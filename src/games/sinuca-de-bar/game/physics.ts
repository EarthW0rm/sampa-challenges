import {
  BALL_R,
  BALL_RESTITUTION,
  CUSHION_RESTITUTION,
  FELT_B,
  FELT_L,
  FELT_R,
  FELT_T,
  JAW_CORNER,
  JAW_FACING,
  JAW_MID,
  LINEAR_DRAG,
  MAX_SHOT_TIME,
  MAX_SUBSTEP_MOVE,
  MID_X,
  PHYS_DT,
  POCKETS,
  ROLL_DECEL,
  STOP_SPEED,
} from './constants';

/**
 * Física da mesa em TypeScript puro (sem canvas): bolas iguais, sem efeito, atrito constante +
 * arrasto, choque elástico com restituição e tabelas como segmentos (as pontas viram as bocas
 * das caçapas). Passo fixo `PHYS_DT`, então o jogo e a previsão da IA dão o mesmo resultado.
 */

export interface Ball {
  /** 0 = branca, 1–15 = numeradas. */
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** false depois de encaçapada. */
  on: boolean;
}

/** O que aconteceu numa tacada (as regras decidem em cima disto). */
export interface ShotEvents {
  /** Primeira bola em que a branca tocou (null = não tocou em nenhuma). */
  firstHit: number | null;
  /** Bolas encaçapadas, na ordem (inclui a branca, 0). */
  pocketed: number[];
}

/** Ganchos para som e animação; a IA simula sem eles. */
export interface PhysicsListener {
  ballHit?(speed: number): void;
  cushionHit?(speed: number): void;
  pocket?(ball: Ball, pocket: { x: number; y: number }): void;
}

interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Tabelas: os trechos do pano entre as bocas das caçapas. */
const RAILS: Segment[] = [
  { ax: FELT_L + JAW_CORNER, ay: FELT_T, bx: MID_X - JAW_MID, by: FELT_T },
  { ax: MID_X + JAW_MID, ay: FELT_T, bx: FELT_R - JAW_CORNER, by: FELT_T },
  { ax: FELT_L + JAW_CORNER, ay: FELT_B, bx: MID_X - JAW_MID, by: FELT_B },
  { ax: MID_X + JAW_MID, ay: FELT_B, bx: FELT_R - JAW_CORNER, by: FELT_B },
  { ax: FELT_L, ay: FELT_T + JAW_CORNER, bx: FELT_L, by: FELT_B - JAW_CORNER },
  { ax: FELT_R, ay: FELT_T + JAW_CORNER, bx: FELT_R, by: FELT_B - JAW_CORNER },
];

/**
 * Quinas cortadas das bocas: saem da ponta de cada tabela para dentro da caçapa (45° nos cantos,
 * quase retas no meio) e desviam para o fundo a bola que entra de lado, em vez de devolvê-la.
 */
function facings(): Segment[] {
  const f = JAW_FACING;
  const d = f / Math.SQRT2;
  const out: Segment[] = [];
  for (const [sx, sy, cx, cy] of [
    [1, 1, FELT_L, FELT_T],
    [-1, 1, FELT_R, FELT_T],
    [1, -1, FELT_L, FELT_B],
    [-1, -1, FELT_R, FELT_B],
  ]) {
    out.push({ ax: cx + sx * JAW_CORNER, ay: cy, bx: cx + sx * (JAW_CORNER - d), by: cy - sy * d });
    out.push({ ax: cx, ay: cy + sy * JAW_CORNER, bx: cx - sx * d, by: cy + sy * (JAW_CORNER - d) });
  }
  for (const [y, sy] of [
    [FELT_T, -1],
    [FELT_B, 1],
  ]) {
    for (const sx of [-1, 1]) out.push({ ax: MID_X + sx * JAW_MID, ay: y, bx: MID_X + sx * (JAW_MID - 1), by: y + sy * f });
  }
  return out;
}

const SEGMENTS: Segment[] = [...RAILS, ...facings()];

export const newEvents = (): ShotEvents => ({ firstHit: null, pocketed: [] });

export function cloneBalls(balls: readonly Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

export function anyMoving(balls: readonly Ball[]): boolean {
  return balls.some((b) => b.on && (b.vx !== 0 || b.vy !== 0));
}

function pocketBall(b: Ball, p: { x: number; y: number }, ev: ShotEvents, l?: PhysicsListener) {
  b.on = false;
  b.vx = b.vy = 0;
  ev.pocketed.push(b.n);
  l?.pocket?.(b, p);
}

function nearestPocket(x: number, y: number) {
  let best = POCKETS[0];
  let bd = Infinity;
  for (const p of POCKETS) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function collideSegment(b: Ball, s: Segment, l?: PhysicsListener) {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const t = Math.max(0, Math.min(1, ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / (dx * dx + dy * dy)));
  const cx = s.ax + dx * t;
  const cy = s.ay + dy * t;
  const ox = b.x - cx;
  const oy = b.y - cy;
  const d2 = ox * ox + oy * oy;
  if (d2 >= BALL_R * BALL_R || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = ox / d;
  const ny = oy / d;
  b.x = cx + nx * BALL_R;
  b.y = cy + ny * BALL_R;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + CUSHION_RESTITUTION) * vn * nx;
    b.vy -= (1 + CUSHION_RESTITUTION) * vn * ny;
    l?.cushionHit?.(-vn);
  }
}

function collideBalls(a: Ball, b: Ball, ev: ShotEvents, l?: PhysicsListener) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = 2 * BALL_R;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d;
  const ny = dy / d;
  // separa as bolas metade para cada lado
  const push = (min - d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vrel <= 0) return;
  const j = ((1 + BALL_RESTITUTION) / 2) * vrel;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  if (ev.firstHit === null) {
    if (a.n === 0) ev.firstHit = b.n;
    else if (b.n === 0) ev.firstHit = a.n;
  }
  l?.ballHit?.(vrel);
}

/** Avança a mesa um passo fixo (`PHYS_DT`), em subpassos curtos. */
export function step(balls: Ball[], ev: ShotEvents, l?: PhysicsListener) {
  let vmax = 0;
  for (const b of balls) if (b.on) vmax = Math.max(vmax, Math.hypot(b.vx, b.vy));
  if (vmax === 0) return;
  const n = Math.max(1, Math.ceil((vmax * PHYS_DT) / MAX_SUBSTEP_MOVE));
  const dt = PHYS_DT / n;
  for (let s = 0; s < n; s++) {
    for (const b of balls) {
      if (!b.on || (b.vx === 0 && b.vy === 0)) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!a.on) continue;
      const aMoving = a.vx !== 0 || a.vy !== 0;
      for (let k = i + 1; k < balls.length; k++) {
        const b = balls[k];
        if (!b.on || (!aMoving && b.vx === 0 && b.vy === 0)) continue;
        collideBalls(a, b, ev, l);
      }
    }
    for (const b of balls) {
      if (!b.on || (b.vx === 0 && b.vy === 0)) continue;
      for (const seg of SEGMENTS) collideSegment(b, seg, l);
      for (const p of POCKETS) {
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < p.r * p.r) {
          pocketBall(b, p, ev, l);
          break;
        }
      }
      // escapou pela boca sem cair (raríssimo): vai para a caçapa mais perto
      if (b.on && (b.x < FELT_L - 6 || b.x > FELT_R + 6 || b.y < FELT_T - 6 || b.y > FELT_B + 6)) {
        pocketBall(b, nearestPocket(b.x, b.y), ev, l);
      }
    }
    // atrito
    for (const b of balls) {
      if (!b.on || (b.vx === 0 && b.vy === 0)) continue;
      const v = Math.hypot(b.vx, b.vy);
      const nv = v - (ROLL_DECEL + LINEAR_DRAG * v) * dt;
      if (nv <= STOP_SPEED) {
        b.vx = b.vy = 0;
      } else {
        const k = nv / v;
        b.vx *= k;
        b.vy *= k;
      }
    }
  }
}

/** Simula a tacada até tudo parar (ou `MAX_SHOT_TIME`). Altera `balls`. */
export function simulate(balls: Ball[], ev: ShotEvents = newEvents(), l?: PhysicsListener): ShotEvents {
  const maxSteps = Math.ceil(MAX_SHOT_TIME / PHYS_DT);
  for (let i = 0; i < maxSteps && anyMoving(balls); i++) step(balls, ev, l);
  for (const b of balls) b.vx = b.vy = 0;
  return ev;
}

/** A branca pode ficar em (x, y)? Dentro do pano, sem encostar em outra bola. */
export function canPlaceCue(balls: readonly Ball[], x: number, y: number, kitchen: boolean, maxX: number): boolean {
  if (x < FELT_L + BALL_R || x > FELT_R - BALL_R || y < FELT_T + BALL_R || y > FELT_B - BALL_R) return false;
  if (kitchen && x > maxX) return false;
  for (const b of balls) {
    if (!b.on || b.n === 0) continue;
    if ((b.x - x) ** 2 + (b.y - y) ** 2 < (2 * BALL_R + 0.5) ** 2) return false;
  }
  return true;
}

/**
 * Primeira coisa que um raio a partir de (x, y) com ângulo `a` encontra, para a linha de mira:
 * uma bola (com a posição da bola-fantasma, onde a branca encosta) ou a tabela.
 */
export function castRay(
  balls: readonly Ball[],
  x: number,
  y: number,
  a: number,
  skip = 0,
): { dist: number; ball: Ball | null } {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = Infinity;
  let hit: Ball | null = null;
  const rr = (2 * BALL_R) ** 2;
  for (const b of balls) {
    if (!b.on || b.n === skip) continue;
    const ox = b.x - x;
    const oy = b.y - y;
    const t = ox * dx + oy * dy;
    if (t <= 0) continue;
    const perp2 = ox * ox + oy * oy - t * t;
    if (perp2 > rr) continue;
    const d = t - Math.sqrt(rr - perp2);
    if (d < best) {
      best = d;
      hit = b;
    }
  }
  // tabelas (o centro da bola para a BALL_R da borda)
  const bounds: number[] = [];
  if (dx > 0) bounds.push((FELT_R - BALL_R - x) / dx);
  if (dx < 0) bounds.push((FELT_L + BALL_R - x) / dx);
  if (dy > 0) bounds.push((FELT_B - BALL_R - y) / dy);
  if (dy < 0) bounds.push((FELT_T + BALL_R - y) / dy);
  const wall = Math.max(0, Math.min(...bounds));
  if (wall < best) return { dist: wall, ball: null };
  return { dist: best, ball: hit };
}
