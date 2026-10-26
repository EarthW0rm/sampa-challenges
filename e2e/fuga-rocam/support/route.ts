/**
 * Rota do cachorro pela grade (lado do Node, com os mapas do próprio jogo): campo de custo até um alvo
 * e a decisão "que seta apertar e quantos quadros andar até decidir de novo". Usado pelos gestos
 * `goToTile` da página e pelo piloto. Nada aqui mexe no jogo: só calcula; quem aperta a seta é a página.
 */
import { COLS, FAST_LANE_MULT, HEAVY_MULT, PLAYER_SPEED, ROWS, TILE, TURBO_MULT, TURN_TOLERANCE } from '../../../src/games/fuga-rocam/game/constants';
import { canEnter, mapById, type GameMap } from '../../../src/games/fuga-rocam/game/maps';
import { DX, DY, type Dir, type MapId } from '../../../src/games/fuga-rocam/game/types';

export const DIR_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] as const;
export type DirKey = (typeof DIR_KEYS)[number];
export const DIR_NAMES = ['direita', 'baixo', 'esquerda', 'cima'] as const;

export type Tile = [number, number];

/** Posição do cachorro como o gancho devolve. */
export interface Pos {
  tx: number;
  ty: number;
  dir: Dir;
  off: number;
}

const idx = (tx: number, ty: number) => ty * COLS + tx;

/** O cachorro pode passar por (tx, ty)? Garagem só se for o próprio alvo. */
export function walkable(map: GameMap, tx: number, ty: number, target: Tile): boolean {
  if (!canEnter(map, 'player', tx, ty)) return false;
  if (map.tiles[ty][tx] === 'g') return tx === target[0] && ty === target[1];
  return true;
}

/** Custo até o alvo por tile (Dijkstra, custo 1 por tile + `extra(tx, ty)`); Infinity = sem caminho. */
export function costField(mapId: MapId, target: Tile, extra?: (tx: number, ty: number) => number): Float64Array {
  const map = mapById(mapId);
  const dist = new Float64Array(COLS * ROWS).fill(Infinity);
  const heap: [number, number][] = [];
  const push = (d: number, k: number) => {
    heap.push([d, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  dist[idx(target[0], target[1])] = 0;
  push(0, idx(target[0], target[1]));
  while (heap.length) {
    const [d, k] = pop();
    if (d > dist[k]) continue;
    const x = k % COLS;
    const y = (k / COLS) | 0;
    for (let i = 0; i < 4; i++) {
      const nx = x + DX[i];
      const ny = y + DY[i];
      if (!walkable(map, nx, ny, target)) continue;
      // custo de entrar em (x, y) vindo de (nx, ny)
      const nd = d + 1 + (extra ? extra(x, y) : 0);
      const nk = idx(nx, ny);
      if (nd < dist[nk]) {
        dist[nk] = nd;
        push(nd, nk);
      }
    }
  }
  return dist;
}

/** Melhor direção a partir de um tile (null = já é o alvo ou sem caminho). */
export function bestDir(mapId: MapId, field: Float64Array, t: Tile, target: Tile, avoidBack?: Dir): Dir | null {
  if (t[0] === target[0] && t[1] === target[1]) return null;
  const map = mapById(mapId);
  let best: Dir | null = null;
  let bd = field[idx(t[0], t[1])];
  if (!Number.isFinite(bd)) bd = Infinity;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const nx = t[0] + DX[d];
    const ny = t[1] + DY[d];
    if (!walkable(map, nx, ny, target)) continue;
    const v = field[idx(nx, ny)];
    if (v < bd && d !== avoidBack) {
      bd = v;
      best = d;
    }
  }
  return best;
}

export interface RouteStep {
  /** Seta a apertar agora (null = não apertar nada). */
  key: DirKey | null;
  /** Quadros a andar antes de decidir de novo. */
  frames: number;
  /** Tile em que a decisão vale (o próximo centro). */
  at: Tile;
}

/**
 * Próximo passo da rota. A seta só é apertada quando a moto passou da folga de curva tardia do tile em
 * que está (senão viraria no tile errado) ou está parada num centro; depois anda até perto da próxima curva.
 */
export function routeStep(mapId: MapId, field: Float64Array, target: Tile, p: Pos, want: Dir | null, opts: { turbo?: boolean; heavy?: boolean } = {}): RouteStep {
  const v = (PLAYER_SPEED * (opts.turbo ? TURBO_MULT : 1) * FAST_LANE_MULT * (opts.heavy ? HEAVY_MULT : 1)) / 60;
  const at: Tile = p.off === 0 ? [p.tx, p.ty] : [p.tx + DX[p.dir], p.ty + DY[p.dir]];
  if (p.off > 0 && p.off <= TURN_TOLERANCE) return { key: null, frames: 1, at };
  const d = bestDir(mapId, field, at, target);
  const toAt = p.off === 0 ? 0 : TILE - p.off;
  if (d === null) return { key: null, frames: Math.max(1, Math.ceil(toAt / v)), at };
  // meia-volta: inverte na hora; decide de novo no quadro seguinte
  if (p.off > 0 && d === (p.dir + 2) % 4) return { key: DIR_KEYS[d], frames: 1, at };
  // quantos tiles em linha reta depois de `at`, até a próxima curva (ou o alvo)
  let n = 1;
  let t: Tile = [at[0] + DX[d], at[1] + DY[d]];
  while (n < 40) {
    const nd = bestDir(mapId, field, t, target);
    if (nd !== d) break;
    t = [t[0] + DX[d], t[1] + DY[d]];
    n++;
  }
  const dist = toAt + n * TILE;
  const frames = Math.max(1, Math.floor((dist - 2) / v));
  return { key: want === d ? null : DIR_KEYS[d], frames, at };
}

export const tileCenter = (t: Tile): { x: number; y: number } => ({ x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE / 2 });
