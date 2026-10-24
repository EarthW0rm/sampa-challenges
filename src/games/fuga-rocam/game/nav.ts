import { COLS, ROWS } from './constants';
import { canEnter, type GameMap } from './maps';
import { DX, DY, type MoverClass } from './types';

/**
 * Campos de distância (BFS) até um tile-alvo, por classe de veículo. A viatura escolhe, a cada
 * esquina, o vizinho com menor distância — assim ela contorna quarteirões em vez de "colar" na parede.
 */
export class Nav {
  private cache = new Map<string, Int16Array>();
  private age = 0;

  constructor(readonly map: GameMap) {}

  clear() {
    this.cache.clear();
  }

  /** Passa o tempo; esvazia o cache de vez em quando para não crescer sem limite. */
  tick(dt: number) {
    this.age += dt;
    if (this.age > 2 || this.cache.size > 80) {
      this.cache.clear();
      this.age = 0;
    }
  }

  /** Tile andável mais próximo (o próprio, se der). */
  snap(cls: MoverClass, tx: number, ty: number): [number, number] {
    if (canEnter(this.map, cls, tx, ty)) return [tx, ty];
    for (let r = 1; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (canEnter(this.map, cls, tx + dx, ty + dy)) return [tx + dx, ty + dy];
        }
      }
    }
    return [tx, ty];
  }

  /** dist[ty*COLS+tx] = passos até o alvo (−1 = inalcançável). */
  field(cls: MoverClass, tx: number, ty: number): Int16Array {
    [tx, ty] = this.snap(cls, tx, ty);
    const key = `${cls}|${tx}|${ty}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const d = new Int16Array(COLS * ROWS).fill(-1);
    const q = new Int32Array(COLS * ROWS);
    let head = 0;
    let tail = 0;
    d[ty * COLS + tx] = 0;
    q[tail++] = ty * COLS + tx;
    while (head < tail) {
      const k = q[head++];
      const x = k % COLS;
      const y = (k / COLS) | 0;
      for (let i = 0; i < 4; i++) {
        const nx = x + DX[i];
        const ny = y + DY[i];
        if (!canEnter(this.map, cls, nx, ny)) continue;
        const nk = ny * COLS + nx;
        if (d[nk] !== -1) continue;
        d[nk] = d[k] + 1;
        q[tail++] = nk;
      }
    }
    this.cache.set(key, d);
    return d;
  }

  dist(cls: MoverClass, from: [number, number], to: [number, number]): number {
    return this.field(cls, to[0], to[1])[from[1] * COLS + from[0]];
  }
}
