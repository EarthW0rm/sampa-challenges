import { DT, H, MAX_FLIGHT_T, MOTO_BOX, PILOT_BOX, POS_SCALE, RIDER_SIZE, SUN_RECT, W } from './constants';
import type { PlayerIndex, Point, Rect, Shot } from './types';

/** Áreas de acerto de um motoboy: o piloto (vitória direta) e a moto (3 acertos). */
export interface RiderBoxes {
  pilot: Rect;
  moto: Rect;
}

export interface World {
  mask: Uint8Array;
  riders: [RiderBoxes, RiderBoxes];
  alive: [boolean, boolean];
  wind: number;
  gravity: number;
}

export interface Flight {
  owner: PlayerIndex;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  step: number;
  x: number;
  y: number;
  leftOwn: boolean;
  touchedSun: boolean;
}

export type FlightEvent =
  | { kind: 'none' }
  | { kind: 'building'; x: number; y: number }
  | { kind: 'pilot' | 'moto'; index: PlayerIndex; x: number; y: number }
  | { kind: 'out' };

/** O jogador 1 olha para a direita; o 2, para a esquerda (sprite espelhado). */
export const facingOf = (p: PlayerIndex): 1 | -1 => (p === 0 ? 1 : -1);

function place(pos: Point, facing: 1 | -1, r: Rect): Rect {
  const x = facing > 0 ? pos.x + r.x : pos.x + RIDER_SIZE - r.x - r.w;
  return { x, y: pos.y + r.y, w: r.w, h: r.h };
}

export function riderBoxes(pos: Point, player: PlayerIndex): RiderBoxes {
  const f = facingOf(player);
  return { pilot: place(pos, f, PILOT_BOX), moto: place(pos, f, MOTO_BOX) };
}

/** Contorno das duas áreas (para "já saiu de perto do dono" e distância da IA). */
export function riderBounds(b: RiderBoxes): Rect {
  const x = Math.min(b.pilot.x, b.moto.x);
  const y = Math.min(b.pilot.y, b.moto.y);
  return {
    x,
    y,
    w: Math.max(b.pilot.x + b.pilot.w, b.moto.x + b.moto.w) - x,
    h: Math.max(b.pilot.y + b.pilot.h, b.moto.y + b.moto.h) - y,
  };
}

/** O capacete sai de cima da cabeça do cachorro. */
export function launchPoint(pos: Point): Point {
  return { x: pos.x + 20, y: pos.y + 2 };
}

export function launch(owner: PlayerIndex, from: Point, shot: Shot): Flight {
  const a = (shot.angle * Math.PI) / 180;
  const dir = facingOf(owner);
  const p = launchPoint(from);
  return {
    owner,
    x0: p.x,
    y0: p.y,
    vx: Math.cos(a) * shot.velocity * dir,
    vy: Math.sin(a) * shot.velocity,
    step: 0,
    x: p.x,
    y: p.y,
    leftOwn: false,
    touchedSun: false,
  };
}

function posAt(f: Flight, t: number, w: World): [number, number] {
  const windAcc = w.wind / 5; // vento/5
  return [
    f.x0 + POS_SCALE * (f.vx * t + 0.5 * windAcc * t * t),
    f.y0 - POS_SCALE * (f.vy * t - 0.5 * w.gravity * t * t),
  ];
}

const inRect = (x: number, y: number, r: Rect) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/**
 * Avança um passo fixo (DT). Determinístico: a IA usa exatamente esta função para prever
 * os tiros, então o que ela calcula é o que acontece na tela.
 */
export function stepFlight(f: Flight, w: World): FlightEvent {
  const px = f.x;
  const py = f.y;
  f.step++;
  const t = f.step * DT;
  const [nx, ny] = posAt(f, t, w);
  const n = Math.max(1, Math.ceil(Math.hypot(nx - px, ny - py) / 1.5));
  const ownBounds = riderBounds(w.riders[f.owner]);
  for (let i = 1; i <= n; i++) {
    const x = px + ((nx - px) * i) / n;
    const y = py + ((ny - py) * i) / n;
    if (x < -10 || x > W + 10 || y >= H || t > MAX_FLIGHT_T) {
      f.x = x;
      f.y = y;
      return { kind: 'out' };
    }
    if (inRect(x, y, SUN_RECT)) f.touchedSun = true;
    for (const idx of [0, 1] as const) {
      if (!w.alive[idx]) continue;
      if (idx === f.owner && !f.leftOwn) continue;
      const r = w.riders[idx];
      // o piloto tem prioridade: acertou a cabeça, acabou
      const kind = inRect(x, y, r.pilot) ? 'pilot' : inRect(x, y, r.moto) ? 'moto' : null;
      if (kind) {
        f.x = x;
        f.y = y;
        return { kind, index: idx, x, y };
      }
    }
    if (!f.leftOwn && !inRect(x, y, ownBounds)) f.leftOwn = true;
    if (x >= 0 && x < W && y >= 0 && w.mask[(y | 0) * W + (x | 0)]) {
      f.x = x;
      f.y = y;
      return { kind: 'building', x, y };
    }
  }
  f.x = nx;
  f.y = ny;
  return { kind: 'none' };
}

export interface SimResult {
  event: Exclude<FlightEvent, { kind: 'none' }>;
  /** Menor distância do capacete ao centro do alvo durante o voo. */
  minDist: number;
}

export function simulate(owner: PlayerIndex, from: Point, shot: Shot, w: World, target: Rect): SimResult {
  const f = launch(owner, from, shot);
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  let minDist = Infinity;
  for (;;) {
    const ev = stepFlight(f, w);
    const d = Math.hypot(f.x - cx, f.y - cy);
    if (d < minDist) minDist = d;
    if (ev.kind !== 'none') return { event: ev, minDist };
  }
}
