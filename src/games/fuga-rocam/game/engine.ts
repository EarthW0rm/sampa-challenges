import type { Assets } from './assets';
import {
  CAR_SPEED, CATCH_DIST, COLS, COP_STAR_BONUS, FAST_LANE_MULT, GARAGE_COOLDOWN, H, HEAT_COOL, HEAT_COOL_HIDDEN, HEAT_DELIVERY,
  HEAT_MAX, HEAT_PER_STAR, HEAT_SEEN, HEAVY_MULT, HELI_SPEED, HIDE_MAX, INVULN_TIME, ITEM_INTERVAL, ITEM_LIFETIME, MAX_ITEMS,
  MAX_LIVES, MOTO_SPEED, OIL_STUN, OIL_TIME, PIZZA_POINTS, PLAYER_SPEED, POINTS, RADIO_MEMORY, ROWS, SHIELD_STUN, SIGHT_TILES,
  START_LIVES, TILE, TIME_BONUS_PER_SEC, TURBO_DRAIN, TURBO_ITEM, TURBO_MIN_RESTART, TURBO_MULT, TURBO_RECHARGE, TURN_TOLERANCE, W,
} from './constants';
import { blit, SCALE, upscaleAll } from './hires';
import type { Input } from './input';
import { renderMapArt } from './mapArt';
import { canEnter, mapById, type GameMap } from './maps';
import { Nav } from './nav';
import { drawPixelText, textWidth } from './pixelFont';
import { loadRecord, saveRecord } from './record';
import { sfx } from './sound';
import { DX, DY, opposite, type Dir, type HudState, type ItemKind, type JobKind, type MapId, type MoverClass, type Phase } from './types';

interface Mover {
  tx: number;
  ty: number;
  dir: Dir;
  /** Distância (px) já andada do centro de (tx,ty) em direção a dir. */
  off: number;
}
type Persona = 'chaser' | 'blocker' | 'fast' | 'ambush';
interface Cop extends Mover {
  id: number;
  cls: 'moto' | 'car';
  persona: Persona;
  stun: number;
  alpha: number;
  leaving: boolean;
  patrol: [number, number] | null;
  sees: boolean;
  pathToPlayer: number;
  moving: number;
}
interface Heli {
  x: number;
  y: number;
  alpha: number;
  leaving: boolean;
}
interface Item {
  kind: ItemKind;
  tx: number;
  ty: number;
  life: number;
}
interface Oil {
  x: number;
  y: number;
  life: number;
}
interface Job {
  kind: JobKind;
  stage: 'pickup' | 'drop';
  pickup: [number, number];
  drop: [number, number];
  timeLeft: number | null;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Popup {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}

const QUOTA: Record<number, { car: number; moto: number; heli: number }> = {
  1: { car: 1, moto: 0, heli: 0 },
  2: { car: 1, moto: 1, heli: 0 },
  3: { car: 2, moto: 1, heli: 0 },
  4: { car: 2, moto: 2, heli: 0 },
  5: { car: 3, moto: 2, heli: 1 },
};
const PERSONAS: Record<'car' | 'moto', Persona[]> = { car: ['chaser', 'blocker', 'chaser'], moto: ['fast', 'ambush'] };
const SPAWN_MIN_DIST = 16;
const SPAWN_INTERVAL = 2.2;
const HELI_LIGHT = 46;
const CARGO_COLOR: Record<JobKind, string> = { normal: '#ffd36b', fragil: '#9fe0ff', urgente: '#ff4d5e', pesado: '#8d83a6' };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const px = (m: Mover) => m.tx * TILE + TILE / 2 + DX[m.dir] * m.off;
const py = (m: Mover) => m.ty * TILE + TILE / 2 + DY[m.dir] * m.off;
const near = (m: Mover): [number, number] => (m.off >= TILE / 2 ? [m.tx + DX[m.dir], m.ty + DY[m.dir]] : [m.tx, m.ty]);
const center = (t: [number, number]): [number, number] => [t[0] * TILE + TILE / 2, t[1] * TILE + TILE / 2];

export class FugaEngine {
  readonly map: GameMap;
  private nav: Nav;
  private rand: () => number;
  private hd: ReturnType<typeof upscaleAll<string>> | null = null;
  private lists: Record<MoverClass, [number, number][]>;

  phase: Phase = 'ready';
  private prevPhase: Phase = 'ready';
  private time = 0;
  private phaseT = 0;
  score = 0;
  record: number;
  private newRecord = false;
  private lives = START_LIVES;
  private heat = 0;
  stars = 1;
  private turbo = 1;
  private turboLocked = false;
  private turboOn = false;
  private shield = false;
  private oil = 1;
  private invuln = 0;
  private garageCd = 0;
  private hideT = 0;
  private hidden = false;
  private deliveries = 0;
  private message = '';
  private messageT = 0;

  player!: Mover;
  cops: Cop[] = [];
  heli: Heli | null = null;
  job: Job | null = null;
  private jobDelay = 0;
  private items: Item[] = [];
  private puddles: Oil[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private lastSeen: { tx: number; ty: number; t: number } | null = null;
  private spawnCd = 0;
  private itemCd = ITEM_INTERVAL * 0.5;
  private nextId = 1;
  private trailCd = 0;
  private lastHud = '';

  constructor(
    assets: Assets,
    private input: Input,
    private onHud: (h: HudState) => void,
    mapId: MapId,
    seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
  ) {
    this.assets = assets;
    this.map = mapById(mapId);
    this.nav = new Nav(this.map);
    this.rand = mulberry32(seed);
    this.record = loadRecord(mapId);
    this.lists = { player: [], moto: [], car: [] };
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        for (const cls of ['player', 'moto', 'car'] as const) if (canEnter(this.map, cls, x, y)) this.lists[cls].push([x, y]);
    this.reset();
  }
  private assets: Assets;

  // ------------------------------------------------------------------ ciclo de vida

  private reset() {
    this.phase = 'ready';
    this.prevPhase = 'ready';
    this.time = 0;
    this.phaseT = 0;
    this.score = 0;
    this.newRecord = false;
    this.lives = START_LIVES;
    this.heat = 0;
    this.stars = 1;
    this.turbo = 1;
    this.turboLocked = false;
    this.turboOn = false;
    this.shield = false;
    this.oil = 1;
    this.invuln = 0;
    this.garageCd = 0;
    this.hideT = 0;
    this.hidden = false;
    this.deliveries = 0;
    this.message = '';
    this.messageT = 0;
    this.cops = [];
    this.heli = null;
    this.job = null;
    this.jobDelay = 0;
    this.items = [];
    this.puddles = [];
    this.particles = [];
    this.popups = [];
    this.lastSeen = null;
    this.spawnCd = 1;
    this.itemCd = ITEM_INTERVAL * 0.5;
    this.nav.clear();
    this.placePlayer();
    this.input.clear();
    this.newJob();
    this.emit(true);
  }

  private placePlayer() {
    const { tx, ty } = this.map.start;
    // começa virado para uma rua livre
    let dir: Dir = 0;
    for (const d of [0, 2, 1, 3] as Dir[]) if (canEnter(this.map, 'player', tx + DX[d], ty + DY[d])) { dir = d; break; }
    this.player = { tx, ty, dir, off: 0 };
    this.hidden = false;
    this.hideT = 0;
  }

  restart() {
    this.commitRecord();
    this.reset();
  }

  dispose() {
    this.commitRecord();
    sfx.silence();
  }

  get isPaused() {
    return this.phase === 'paused';
  }

  setPaused(p: boolean) {
    if (p && (this.phase === 'play' || this.phase === 'ready' || this.phase === 'caught')) {
      this.prevPhase = this.phase;
      this.phase = 'paused';
      sfx.silence();
      this.input.clear();
    } else if (!p && this.phase === 'paused') {
      this.phase = this.prevPhase;
    }
    this.emit(true);
  }

  private commitRecord() {
    if (this.score > this.record) {
      this.record = this.score;
      saveRecord(this.map.id, this.score);
    }
  }

  // ------------------------------------------------------------------ utilidades

  private say(text: string, t = 2) {
    this.message = text;
    this.messageT = t;
  }

  private pop(x: number, y: number, text: string, color = '#fff2b8') {
    this.popups.push({ x, y, text, t: 0, color });
  }

  private burst(x: number, y: number, n: number, colors: string[], speed = 40, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = speed * (0.3 + this.rand() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color: colors[Math.floor(this.rand() * colors.length)], size: 1 + Math.floor(this.rand() * 2) });
    }
  }

  private canPlayer(tx: number, ty: number): boolean {
    if (!canEnter(this.map, 'player', tx, ty)) return false;
    if (this.garageCd > 0 && this.map.tiles[ty][tx] === 'g') return false;
    return true;
  }

  private speedMult(m: Mover): number {
    const [tx, ty] = near(m);
    return this.map.tiles[ty]?.[tx] === 'f' ? FAST_LANE_MULT : 1;
  }

  /** Anda `dist` px; a cada centro de tile pergunta a `choose` para onde ir (null = parar). */
  private advance(m: Mover, dist: number, choose: (m: Mover) => Dir | null) {
    let guard = 0;
    while (dist > 1e-6 && guard++ < 8) {
      if (m.off === 0) {
        const d = choose(m);
        if (d === null) return;
        m.dir = d;
      }
      const rem = TILE - m.off;
      if (dist >= rem) {
        dist -= rem;
        m.tx += DX[m.dir];
        m.ty += DY[m.dir];
        m.off = 0;
      } else {
        m.off += dist;
        dist = 0;
      }
    }
  }

  private fieldFor(cls: MoverClass, t: [number, number]) {
    return this.nav.field(cls, t[0], t[1]);
  }

  private pathDist(cls: 'moto' | 'car', m: Mover): number {
    const [tx, ty] = near(m);
    return this.fieldFor(cls, near(this.player))[ty * COLS + tx];
  }

  // ------------------------------------------------------------------ jogador

  private choosePlayer = (m: Mover): Dir | null => {
    const ok = (d: Dir) => this.canPlayer(m.tx + DX[d], m.ty + DY[d]);
    if (this.map.tiles[m.ty][m.tx] === 'g' && this.hideT > HIDE_MAX) {
      for (const d of [0, 1, 2, 3] as Dir[]) if (ok(d)) return d;
    }
    const want = this.input.want;
    if (want !== null && ok(want)) return want;
    if (ok(m.dir)) return m.dir;
    return null;
  };

  private steerPlayer() {
    const p = this.player;
    let want = this.input.want;
    // saindo à força da garagem
    if (this.hideT > HIDE_MAX && this.hidden) {
      const [nx, ny] = near(p);
      for (const d of [0, 1, 2, 3] as Dir[]) if (this.map.tiles[ny + DY[d]]?.[nx + DX[d]] && this.canPlayer(nx + DX[d], ny + DY[d]) && this.map.tiles[ny][nx] === 'g') want = d;
    }
    if (want === null || p.off <= 0 || want === p.dir) return;
    if (want === opposite(p.dir)) {
      p.tx += DX[p.dir];
      p.ty += DY[p.dir];
      p.off = TILE - p.off;
      p.dir = want;
      return;
    }
    const remain = TILE - p.off;
    if (remain <= TURN_TOLERANCE) {
      const nx = p.tx + DX[p.dir];
      const ny = p.ty + DY[p.dir];
      if (this.canPlayer(nx + DX[want], ny + DY[want])) {
        p.tx = nx;
        p.ty = ny;
        p.off = 0;
        p.dir = want;
      }
    } else if (p.off <= TURN_TOLERANCE && this.canPlayer(p.tx + DX[want], p.ty + DY[want])) {
      p.off = 0;
      p.dir = want;
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    this.steerPlayer();
    const carrying = this.job?.stage === 'drop' ? this.job.kind : null;
    const wantsTurbo = this.input.turbo;
    if (wantsTurbo && carrying === 'fragil' && this.messageT < 0.2 && !this.hidden) this.say('Frágil: sem turbo!', 1.2);
    const canTurbo = wantsTurbo && carrying !== 'fragil' && !this.turboLocked && this.turbo > 0 && !this.hidden;
    if (canTurbo) {
      if (!this.turboOn) sfx.turbo(true);
      this.turbo = Math.max(0, this.turbo - TURBO_DRAIN * dt);
      if (this.turbo <= 0) this.turboLocked = true;
    } else {
      this.turbo = Math.min(1, this.turbo + TURBO_RECHARGE * dt);
      if (this.turboLocked && this.turbo >= TURBO_MIN_RESTART) this.turboLocked = false;
    }
    this.turboOn = canTurbo;
    const speed = PLAYER_SPEED * (carrying === 'pesado' ? HEAVY_MULT : 1) * (canTurbo ? TURBO_MULT : 1) * this.speedMult(p);
    this.advance(p, speed * dt, this.choosePlayer);

    // garagem: escondido quando o centro mais próximo é uma garagem
    const [nx, ny] = near(p);
    const inGarage = this.map.tiles[ny][nx] === 'g';
    if (inGarage && !this.hidden) {
      this.hidden = true;
      this.hideT = 0;
      sfx.hide();
      this.say('Escondido na garagem', 1.5);
    } else if (!inGarage && this.hidden) {
      this.hidden = false;
      this.hideT = 0;
      this.garageCd = GARAGE_COOLDOWN;
    }
    if (this.hidden) this.hideT += dt;
    if (this.garageCd > 0) this.garageCd = Math.max(0, this.garageCd - dt);

    // fumaça/chama do turbo
    if (canTurbo) {
      this.trailCd -= dt;
      if (this.trailCd <= 0) {
        this.trailCd = 0.03;
        const bx = px(p) - DX[p.dir] * 10;
        const by = py(p) - DY[p.dir] * 10;
        this.particles.push({ x: bx, y: by, vx: -DX[p.dir] * 25 + (this.rand() - 0.5) * 12, vy: -DY[p.dir] * 25 + (this.rand() - 0.5) * 12, life: 0.3, max: 0.3, color: this.rand() < 0.5 ? '#ffb347' : '#ff6b35', size: 2 });
      }
    }
  }

  // ------------------------------------------------------------------ viaturas

  private knownPos(): [number, number] | null {
    if (!this.lastSeen) return null;
    const mem = RADIO_MEMORY * (this.stars >= 4 ? 2 : 1);
    if (this.time - this.lastSeen.t > mem) return null;
    return [this.lastSeen.tx, this.lastSeen.ty];
  }

  private aheadOfPlayer(n: number, cls: MoverClass): [number, number] {
    const p = this.player;
    let [tx, ty] = near(p);
    for (let i = 0; i < n; i++) {
      if (!canEnter(this.map, cls, tx + DX[p.dir], ty + DY[p.dir])) break;
      tx += DX[p.dir];
      ty += DY[p.dir];
    }
    return [tx, ty];
  }

  private patrolTarget(c: Cop): [number, number] {
    const list = this.lists[c.cls];
    if (this.rand() < 0.6) {
      const f = this.fieldFor(c.cls, near(this.player));
      for (let i = 0; i < 25; i++) {
        const t = list[Math.floor(this.rand() * list.length)];
        const d = f[t[1] * COLS + t[0]];
        if (d >= 6 && d <= 16) return t;
      }
    }
    return list[Math.floor(this.rand() * list.length)];
  }

  private copTarget(c: Cop): [number, number] | null {
    const known = this.knownPos();
    const dKnown = c.pathToPlayer;
    switch (c.persona) {
      case 'blocker':
        if (known) return dKnown >= 0 && dKnown <= 5 ? known : this.aheadOfPlayer(4, c.cls);
        break;
      case 'ambush':
        if (known && dKnown >= 0 && dKnown <= 6) return known;
        if (this.job && known) return this.job.stage === 'pickup' ? this.job.pickup : this.job.drop;
        if (known) return known;
        break;
      default:
        if (known) return known;
    }
    // sem pista: ronda pela região
    const [cx, cy] = near(c);
    if (!c.patrol || (cx === c.patrol[0] && cy === c.patrol[1])) c.patrol = this.patrolTarget(c);
    return c.patrol;
  }

  private chooseCop(c: Cop): Dir | null {
    const cand: Dir[] = [];
    for (const d of [0, 1, 2, 3] as Dir[]) if (canEnter(this.map, c.cls, c.tx + DX[d], c.ty + DY[d])) cand.push(d);
    if (!cand.length) return null;
    const back = opposite(c.dir);
    const fwd = cand.filter((d) => d !== back);
    const opts = fwd.length ? fwd : cand;
    if (opts.length === 1) return opts[0];
    const target = this.copTarget(c);
    const randomness = c.sees ? 0.05 : 0.14;
    if (!target || this.rand() < randomness) return opts[Math.floor(this.rand() * opts.length)];
    const f = this.fieldFor(c.cls, target);
    let best: Dir = opts[0];
    let bd = 1e9;
    for (const d of opts) {
      const v = f[(c.ty + DY[d]) * COLS + c.tx + DX[d]];
      const score = v < 0 ? 1e8 : v + this.rand() * 0.01;
      if (score < bd) {
        bd = score;
        best = d;
      }
    }
    return best;
  }

  private copCount(cls: 'moto' | 'car') {
    return this.cops.filter((c) => c.cls === cls && !c.leaving).length;
  }

  private spawnCop(cls: 'moto' | 'car') {
    const f = this.fieldFor(cls, near(this.player));
    const list = this.lists[cls];
    let pick: [number, number] | null = null;
    let far = -1;
    let farT: [number, number] = list[0];
    for (let i = 0; i < 40; i++) {
      const t = list[Math.floor(this.rand() * list.length)];
      const d = f[t[1] * COLS + t[0]];
      if (this.map.tiles[t[1]][t[0]] === 'o') continue;
      if (d > far) {
        far = d;
        farT = t;
      }
      if (d >= SPAWN_MIN_DIST) {
        pick = t;
        break;
      }
    }
    const [tx, ty] = pick ?? farT;
    const pool = PERSONAS[cls].slice();
    for (const c of this.cops) if (c.cls === cls && !c.leaving) {
      const i = pool.indexOf(c.persona);
      if (i >= 0) pool.splice(i, 1);
    }
    const persona = pool[0] ?? PERSONAS[cls][0];
    const dirs = ([0, 1, 2, 3] as Dir[]).filter((d) => canEnter(this.map, cls, tx + DX[d], ty + DY[d]));
    const dir = dirs.length ? dirs[Math.floor(this.rand() * dirs.length)] : 0;
    this.cops.push({ id: this.nextId++, cls, persona, tx, ty, dir, off: 0, stun: 0, alpha: 0, leaving: false, patrol: null, sees: false, pathToPlayer: -1, moving: 0 });
  }

  private updateCops(dt: number): boolean {
    let seen = false;
    for (const c of this.cops) {
      c.pathToPlayer = this.pathDist(c.cls, c);
      c.sees = !this.hidden && c.pathToPlayer >= 0 && c.pathToPlayer <= SIGHT_TILES && c.alpha > 0.5 && !c.leaving;
      if (c.sees) seen = true;
    }
    if (!this.hidden && this.heli && this.heli.alpha > 0.5 && !this.heli.leaving) {
      const dx = this.heli.x - px(this.player);
      const dy = this.heli.y - py(this.player);
      if (dx * dx + dy * dy <= HELI_LIGHT * HELI_LIGHT) seen = true;
    }
    if (seen) {
      const [tx, ty] = near(this.player);
      this.lastSeen = { tx, ty, t: this.time };
    }

    for (const c of this.cops) {
      c.alpha = c.leaving ? Math.max(0, c.alpha - dt * 1.2) : Math.min(1, c.alpha + dt);
      if (c.stun > 0) {
        c.stun -= dt;
        c.moving = 0;
        continue;
      }
      const base = c.cls === 'car' ? CAR_SPEED : MOTO_SPEED;
      let speed = base * (c.persona === 'fast' ? 1.06 : 1) * (1 + COP_STAR_BONUS * (this.stars - 1)) * this.speedMult(c);
      // não atropela a viatura da frente
      const cx = px(c);
      const cy = py(c);
      for (const o of this.cops) {
        if (o === c) continue;
        const ox = px(o) - cx;
        const oy = py(o) - cy;
        if (Math.abs(ox) < 14 && Math.abs(oy) < 14 && ox * DX[c.dir] + oy * DY[c.dir] > 0 && (o.dir === c.dir || o.stun > 0)) speed *= 0.5;
      }
      this.advance(c, speed * dt, (m) => this.chooseCop(m as Cop));
      c.moving += dt;
    }
    this.cops = this.cops.filter((c) => !(c.leaving && c.alpha <= 0));

    // helicóptero
    const h = this.heli;
    if (h) {
      const tx = px(this.player);
      const ty = py(this.player);
      const dx = tx - h.x;
      const dy = ty - h.y;
      const d = Math.hypot(dx, dy) || 1;
      if (h.leaving) {
        h.alpha -= dt;
        h.x += (h.x < W / 2 ? -1 : 1) * HELI_SPEED * dt;
        if (h.alpha <= 0) this.heli = null;
      } else {
        h.alpha = Math.min(1, h.alpha + dt * 0.8);
        h.x += (dx / d) * HELI_SPEED * dt;
        h.y += (dy / d) * HELI_SPEED * dt;
      }
    }
    return seen;
  }

  private manageQuota(dt: number) {
    const q = QUOTA[this.stars];
    this.spawnCd -= dt;
    for (const cls of ['car', 'moto'] as const) {
      const want = cls === 'car' ? q.car : q.moto;
      const have = this.copCount(cls);
      if (have < want && this.spawnCd <= 0) {
        this.spawnCop(cls);
        this.spawnCd = SPAWN_INTERVAL;
      } else if (have > want) {
        const c = this.cops.find((o) => o.cls === cls && !o.leaving && !o.sees && (o.pathToPlayer < 0 || o.pathToPlayer > 14));
        if (c) c.leaving = true;
      }
    }
    if (q.heli > 0 && !this.heli) {
      const corners: [number, number][] = [[-20, -20], [W + 20, -20], [-20, H + 20], [W + 20, H + 20]];
      const [ppx, ppy] = [px(this.player), py(this.player)];
      corners.sort((a, b) => Math.hypot(b[0] - ppx, b[1] - ppy) - Math.hypot(a[0] - ppx, a[1] - ppy));
      this.heli = { x: corners[0][0], y: corners[0][1], alpha: 0, leaving: false };
      this.say('Helicóptero na área!', 2);
    } else if (q.heli === 0 && this.heli) this.heli.leaving = true;
  }

  // ------------------------------------------------------------------ entregas

  private weightedKind(): JobKind {
    const pool: JobKind[] = ['normal', 'normal', 'normal'];
    if (this.deliveries >= 2) pool.push('fragil', 'fragil');
    if (this.deliveries >= 3) pool.push('urgente', 'urgente');
    if (this.deliveries >= 4) pool.push('pesado', 'pesado');
    return pool[Math.floor(this.rand() * pool.length)];
  }

  private newJob() {
    const f = this.fieldFor('player', near(this.player));
    const isSpot = (t: [number, number]) => {
      const c = this.map.tiles[t[1]][t[0]];
      return c === '.' || c === 'f';
    };
    const list = this.lists.player.filter(isSpot);
    let P: [number, number] | null = null;
    for (let i = 0; i < 60 && !P; i++) {
      const t = list[Math.floor(this.rand() * list.length)];
      const d = f[t[1] * COLS + t[0]];
      if (d >= 12 && d <= 40) P = t;
    }
    P ??= list[Math.floor(this.rand() * list.length)];
    const fp = this.fieldFor('player', P);
    let D: [number, number] | null = null;
    for (let i = 0; i < 80 && !D; i++) {
      const t = list[Math.floor(this.rand() * list.length)];
      const d = fp[t[1] * COLS + t[0]];
      if (d >= 20 && d <= 60) D = t;
    }
    D ??= list[Math.floor(this.rand() * list.length)];
    this.job = { kind: this.weightedKind(), stage: 'pickup', pickup: P, drop: D, timeLeft: null };
  }

  private updateJob(dt: number) {
    if (this.jobDelay > 0) {
      this.jobDelay -= dt;
      if (this.jobDelay <= 0) {
        this.newJob();
        this.say(this.job!.kind === 'normal' ? 'Novo pedido!' : `Pedido ${this.job!.kind}!`, 2);
      }
      return;
    }
    const job = this.job;
    if (!job) return;
    const target = job.stage === 'pickup' ? job.pickup : job.drop;
    const [cx, cy] = center(target);
    const dx = px(this.player) - cx;
    const dy = py(this.player) - cy;
    if (job.timeLeft !== null && job.stage === 'drop') {
      job.timeLeft -= dt;
      if (job.timeLeft <= 0) {
        this.say('Atrasou! Pedido perdido', 2.5);
        sfx.starDown();
        this.heat = Math.min(HEAT_MAX, this.heat + 8);
        this.job = null;
        this.jobDelay = 1.5;
        return;
      }
    }
    if (dx * dx + dy * dy > 9 * 9 || this.hidden) return;
    if (job.stage === 'pickup') {
      job.stage = 'drop';
      if (job.kind === 'urgente') {
        const tiles = this.nav.dist('player', job.pickup, job.drop);
        job.timeLeft = Math.max(10, ((tiles * TILE) / PLAYER_SPEED) * 1.4 + 8);
      }
      sfx.pickup();
      this.burst(cx, cy, 8, ['#ffd36b', '#fff2b8'], 50);
      this.say(job.kind === 'fragil' ? 'Frágil! Sem turbo' : job.kind === 'pesado' ? 'Pesado: mais lento' : job.kind === 'urgente' ? 'Urgente! Corre!' : 'Pedido coletado!', 2);
    } else {
      const mult = 1 + 0.25 * (this.stars - 1);
      let pts = POINTS[job.kind] * mult;
      if (job.timeLeft !== null) pts += Math.floor(job.timeLeft) * TIME_BONUS_PER_SEC;
      pts = Math.round(pts);
      this.score += pts;
      this.deliveries++;
      this.heat = Math.min(HEAT_MAX, this.heat + HEAT_DELIVERY + (job.kind === 'pesado' ? 8 : 0));
      sfx.deliver();
      this.burst(cx, cy, 14, ['#5fd17a', '#fff2b8', '#ffd36b'], 70, 0.7);
      this.pop(cx - 8, cy - 14, `+${pts}`, '#5fd17a');
      this.say(`Entrega feita! +${pts}`, 2.2);
      this.job = null;
      this.jobDelay = 1.2;
      if (this.score > this.record && !this.newRecord && this.record > 0) {
        this.newRecord = true;
        sfx.record();
      }
    }
  }

  // ------------------------------------------------------------------ itens e óleo

  private updateItems(dt: number) {
    for (const it of this.items) it.life -= dt;
    this.items = this.items.filter((i) => i.life > 0);
    this.itemCd -= dt;
    if (this.itemCd <= 0 && this.items.length < MAX_ITEMS) {
      this.itemCd = ITEM_INTERVAL;
      const f = this.fieldFor('player', near(this.player));
      const list = this.lists.player;
      for (let i = 0; i < 40; i++) {
        const t = list[Math.floor(this.rand() * list.length)];
        const tile = this.map.tiles[t[1]][t[0]];
        if (tile !== '.' && tile !== 'f') continue;
        if (f[t[1] * COLS + t[0]] < 6) continue;
        if (this.items.some((o) => o.tx === t[0] && o.ty === t[1])) continue;
        const pool: ItemKind[] = ['turbo', 'turbo', 'turbo', 'oleo', 'oleo', 'oleo', 'capacete', 'capacete', 'pizza', 'pizza', 'pizza'];
        if (this.lives < MAX_LIVES) pool.push('vida');
        this.items.push({ kind: pool[Math.floor(this.rand() * pool.length)], tx: t[0], ty: t[1], life: ITEM_LIFETIME });
        break;
      }
    }
    if (this.hidden) return;
    const ppx = px(this.player);
    const ppy = py(this.player);
    this.items = this.items.filter((it) => {
      const [cx, cy] = center([it.tx, it.ty]);
      if ((cx - ppx) ** 2 + (cy - ppy) ** 2 > 10 * 10) return true;
      switch (it.kind) {
        case 'turbo':
          this.turbo = Math.min(1, this.turbo + TURBO_ITEM);
          this.turboLocked = false;
          this.say('Turbo carregado!');
          break;
        case 'oleo':
          this.oil = Math.min(3, this.oil + 1);
          this.say('Óleo! Toque X para soltar');
          break;
        case 'capacete':
          this.shield = true;
          this.say('Capacete: escudo!');
          break;
        case 'pizza':
          this.score += PIZZA_POINTS;
          this.pop(cx - 8, cy - 12, `+${PIZZA_POINTS}`);
          this.say(`Pizza! +${PIZZA_POINTS}`);
          break;
        case 'vida':
          this.lives = Math.min(MAX_LIVES, this.lives + 1);
          this.say('Vida extra!');
          break;
      }
      sfx.item(it.kind);
      this.burst(cx, cy, 8, ['#fff2b8', '#ffffff'], 45);
      return false;
    });
  }

  private updateOil(dt: number) {
    if (this.input.takeOil() && this.oil > 0 && !this.hidden) {
      this.oil--;
      const p = this.player;
      this.puddles.push({ x: px(p) - DX[p.dir] * 6, y: py(p) - DY[p.dir] * 6, life: OIL_TIME });
      sfx.oil();
    }
    for (const o of this.puddles) o.life -= dt;
    this.puddles = this.puddles.filter((o) => {
      if (o.life <= 0) return false;
      for (const c of this.cops) {
        if (c.stun > 0 || c.alpha < 0.5 || c.leaving) continue;
        if ((px(c) - o.x) ** 2 + (py(c) - o.y) ** 2 < 10 * 10) {
          c.stun = OIL_STUN;
          sfx.skid();
          this.burst(o.x, o.y, 10, ['#2a2438', '#5e5870', '#fff2b8'], 50);
          this.pop(o.x - 14, o.y - 14, 'derrapou', '#9fe0ff');
          return false;
        }
      }
      return true;
    });
  }

  // ------------------------------------------------------------------ pego

  private checkCaught() {
    if (this.invuln > 0 || this.hidden) return;
    const ppx = px(this.player);
    const ppy = py(this.player);
    for (const c of this.cops) {
      if (c.alpha < 0.9 || c.stun > 0 || c.leaving) continue;
      if ((px(c) - ppx) ** 2 + (py(c) - ppy) ** 2 > CATCH_DIST * CATCH_DIST) continue;
      if (this.shield) {
        this.shield = false;
        c.stun = SHIELD_STUN;
        this.invuln = 1;
        sfx.shield();
        this.burst(ppx, ppy, 16, ['#7fe3ff', '#ffffff'], 80);
        this.say('O capacete salvou!');
        return;
      }
      this.lives--;
      this.phase = 'caught';
      this.phaseT = 0;
      sfx.silence();
      sfx.caught();
      this.burst(ppx, ppy, 22, ['#ff4d5e', '#4da3ff', '#ffffff'], 90, 0.8);
      this.input.clear();
      return;
    }
  }

  private afterCaught() {
    if (this.lives <= 0) {
      this.phase = 'over';
      this.commitRecord();
      if (this.newRecord) sfx.record();
      sfx.gameOver();
      this.emit(true);
      return;
    }
    this.cops = [];
    this.heli = null;
    this.lastSeen = null;
    this.heat *= 0.5;
    this.stars = 1 + Math.min(4, Math.floor(this.heat / HEAT_PER_STAR));
    this.puddles = [];
    this.spawnCd = 2;
    this.garageCd = 0;
    this.placePlayer();
    this.invuln = INVULN_TIME;
    this.phase = 'ready';
    this.say('Foge!', 1.5);
  }

  // ------------------------------------------------------------------ laço

  update(rawDt: number) {
    const dt = Math.max(0, Math.min(rawDt, 0.05));
    if (this.phase === 'paused' || this.phase === 'over') {
      this.tickFx(dt);
      this.emit();
      return;
    }
    this.time += dt;
    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) this.message = '';
    }
    if (this.phase === 'ready') {
      if (this.input.want !== null) {
        this.phase = 'play';
        if (this.time < 0.5 + dt * 2 || this.deliveries === 0) sfx.start();
        this.say(this.job?.stage === 'pickup' ? 'Vá até o pino amarelo' : '', 3);
      }
      this.tickFx(dt);
      this.emit();
      return;
    }
    if (this.phase === 'caught') {
      this.phaseT += dt;
      this.tickFx(dt);
      if (this.phaseT > 1.5) this.afterCaught();
      this.emit();
      return;
    }

    // jogando
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    this.nav.tick(dt);
    this.updatePlayer(dt);
    const seen = this.updateCops(dt);
    const prevStars = this.stars;
    if (this.hidden) this.heat -= HEAT_COOL_HIDDEN * dt;
    else if (seen) this.heat += HEAT_SEEN * dt;
    else this.heat -= HEAT_COOL * dt;
    this.heat = Math.max(0, Math.min(HEAT_MAX, this.heat));
    this.stars = 1 + Math.min(4, Math.floor(this.heat / HEAT_PER_STAR));
    if (this.stars > prevStars) {
      sfx.starUp(this.stars);
      this.say(`Procurado: ${this.stars} estrela${this.stars > 1 ? 's' : ''}!`, 2);
    } else if (this.stars < prevStars) sfx.starDown();
    this.manageQuota(dt);
    this.updateJob(dt);
    this.updateItems(dt);
    this.updateOil(dt);
    this.checkCaught();
    this.tickFx(dt);

    // som ambiente
    let nearest = 0;
    for (const c of this.cops) if (c.pathToPlayer >= 0 && !c.leaving) nearest = Math.max(nearest, 1 - c.pathToPlayer / 14);
    let heli = 0;
    if (this.heli) heli = Math.max(0, 1 - Math.hypot(this.heli.x - px(this.player), this.heli.y - py(this.player)) / 220) * this.heli.alpha;
    sfx.ambient(dt, nearest, heli);
    this.emit();
  }

  private tickFx(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.2);
  }

  // ------------------------------------------------------------------ HUD

  private emit(force = false) {
    const job = this.job;
    const hud: HudState = {
      phase: this.phase,
      score: this.score,
      record: Math.max(this.record, this.score),
      newRecord: this.newRecord || (this.score > this.record && this.record > 0),
      lives: this.lives,
      stars: this.stars,
      heat: Math.round(this.heat),
      turbo: Math.round(this.turbo * 50) / 50,
      turboLocked: this.turboLocked,
      shield: this.shield,
      oil: this.oil,
      hidden: this.hidden,
      hideLeft: this.hidden ? Math.max(0, Math.ceil((HIDE_MAX - this.hideT) * 2) / 2) : 0,
      deliveries: this.deliveries,
      job: job ? { kind: job.kind, stage: job.stage, timeLeft: job.timeLeft === null ? null : Math.max(0, Math.ceil(job.timeLeft)) } : null,
      message: this.message,
      map: this.map.id,
    };
    const key = JSON.stringify(hud);
    if (force || key !== this.lastHud) {
      this.lastHud = key;
      this.onHud(hud);
    }
  }

  /** Estado interno para testes automáticos. */
  snapshot() {
    return {
      phase: this.phase,
      player: { ...this.player, x: px(this.player), y: py(this.player) },
      cops: this.cops.map((c) => ({ id: c.id, cls: c.cls, persona: c.persona, x: px(c), y: py(c), sees: c.sees, stun: c.stun, d: c.pathToPlayer, alpha: c.alpha })),
      job: this.job,
      heat: this.heat,
      stars: this.stars,
      lives: this.lives,
      score: this.score,
      hidden: this.hidden,
      items: this.items.length,
      oil: this.oil,
      shield: this.shield,
      deliveries: this.deliveries,
      heli: !!this.heli,
    };
  }

  /** Retrato completo para o gancho dos testes de ponta a ponta (`game/e2eHook.ts`): só leitura, serializável. */
  e2eState() {
    const s = this.snapshot();
    return {
      ...s,
      job: this.job ? { ...this.job, pickup: [...this.job.pickup] as [number, number], drop: [...this.job.drop] as [number, number] } : null,
      map: this.map.id,
      want: this.input.want,
      turbo: this.turbo,
      turboLocked: this.turboLocked,
      turboOn: this.turboOn,
      invuln: this.invuln,
      garageCd: this.garageCd,
      hideT: this.hideT,
      record: this.record,
      newRecord: this.newRecord,
      message: this.message,
      time: this.time,
      phaseT: this.phaseT,
      jobDelay: this.jobDelay,
      lastSeen: this.lastSeen ? { ...this.lastSeen } : null,
      itemList: this.items.map((i) => ({ ...i })),
      puddles: this.puddles.map((o) => ({ ...o })),
      copList: this.cops.map((c) => ({ id: c.id, cls: c.cls, persona: c.persona, tx: c.tx, ty: c.ty, dir: c.dir, off: c.off, x: px(c), y: py(c), stun: c.stun, alpha: c.alpha, leaving: c.leaving, sees: c.sees, d: c.pathToPlayer })),
      heliPos: this.heli ? { ...this.heli } : null,
    };
  }

  /** Alvos em coordenadas lógicas (centro dos pinos, itens e garagens) para o gancho dos testes. */
  e2eTargets() {
    const job = this.job;
    const garages: { tx: number; ty: number; x: number; y: number }[] = [];
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++) if (this.map.tiles[ty][tx] === 'g') garages.push({ tx, ty, x: center([tx, ty])[0], y: center([tx, ty])[1] });
    const pin = (t: [number, number]) => ({ tx: t[0], ty: t[1], x: center(t)[0], y: center(t)[1] });
    return {
      player: { x: px(this.player), y: py(this.player) },
      pickup: job && job.stage === 'pickup' ? pin(job.pickup) : null,
      drop: job ? pin(job.drop) : null,
      items: this.items.map((i) => ({ kind: i.kind, ...pin([i.tx, i.ty]) })),
      garages,
    };
  }

  /** Atalhos para testes (pré-condições raras; o gancho só os expõe em `prepare`). */
  cheat = {
    heat: (v: number) => {
      this.heat = v;
    },
    player: () => this.player,
    nav: () => this.nav,
    map: () => this.map,
    /** Põe um item num tile (substitui o que houver nele). */
    item: (kind: ItemKind, tx: number, ty: number) => {
      this.items = this.items.filter((i) => i.tx !== tx || i.ty !== ty);
      this.items.push({ kind, tx, ty, life: ITEM_LIFETIME });
    },
    /** Põe uma viatura já visível num tile, virada para `dir`. */
    cop: (cls: 'moto' | 'car', tx: number, ty: number, dir: Dir = 0) => {
      const persona = PERSONAS[cls][0];
      this.cops.push({ id: this.nextId++, cls, persona, tx, ty, dir, off: 0, stun: 0, alpha: 1, leaving: false, patrol: null, sees: false, pathToPlayer: -1, moving: 0 });
    },
    /** Troca o tipo do pedido atual. */
    jobKind: (kind: JobKind) => {
      if (this.job) this.job.kind = kind;
    },
    lives: (n: number) => {
      this.lives = n;
    },
  };

  // ------------------------------------------------------------------ desenho

  render(ctx: CanvasRenderingContext2D) {
    if (!this.hd) this.hd = upscaleAll(this.assets);
    const hd = this.hd;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderMapArt(this.map), 0, 0, W, H);

    // óleo
    for (const o of this.puddles) {
      ctx.globalAlpha = Math.min(1, o.life / 3) * 0.9;
      ctx.fillStyle = '#120d1c';
      ctx.beginPath();
      ctx.ellipse(Math.round(o.x), Math.round(o.y), 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5e5aa0';
      ctx.fillRect(Math.round(o.x) - 3, Math.round(o.y) - 2, 3, 1);
      ctx.globalAlpha = 1;
    }

    // garagens: anel verde disponível / vermelho trancada
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    for (let ty = 0; ty < ROWS; ty++)
      for (let tx = 0; tx < COLS; tx++) {
        if (this.map.tiles[ty][tx] !== 'g') continue;
        ctx.globalAlpha = 0.35 + 0.35 * pulse;
        ctx.strokeStyle = this.garageCd > 0 ? '#ff4d5e' : '#5fd17a';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
        ctx.globalAlpha = 1;
      }

    // pinos
    if (this.job) {
      const t = this.job.stage === 'pickup' ? this.job.pickup : this.job.drop;
      const [cx, cy] = center(t);
      const img = hd[this.job.stage === 'pickup' ? 'pino_coleta' : 'pino_entrega'];
      const bob = Math.round(Math.sin(this.time * 5) * 2);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      blit(ctx, img, Math.round(cx - img.width / SCALE / 2), Math.round(cy - img.height / SCALE + 3 + bob));
    }

    // itens
    for (const it of this.items) {
      const [cx, cy] = center([it.tx, it.ty]);
      if (it.life < 5 && Math.floor(this.time * 8) % 2 === 0) continue;
      const img = hd[`item_${it.kind}`];
      const bob = Math.round(Math.sin(this.time * 4 + it.tx) * 1.5);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      blit(ctx, img, Math.round(cx - img.width / SCALE / 2), Math.round(cy - img.height / SCALE / 2 + bob - 1));
    }

    // luz das sirenes
    const flip = Math.floor(this.time * 6) % 2 === 0;
    for (const c of this.cops) {
      const x = px(c);
      const y = py(c);
      const g = ctx.createRadialGradient(x, y, 2, x, y, 22);
      const col = flip ? '255,60,70' : '70,140,255';
      g.addColorStop(0, `rgba(${col},${0.4 * c.alpha})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 22, y - 22, 44, 44);
    }

    // veículos ordenados por y
    type Ent = { y: number; draw: () => void };
    const ents: Ent[] = [];
    const dirKey = ['r', 'd', 'l', 'u'];
    for (const c of this.cops) {
      ents.push({
        y: py(c),
        draw: () => {
          const frame = Math.floor(this.time * 8) % 2;
          const img = hd[`${c.cls === 'car' ? 'carro' : 'motopm'}_${dirKey[c.dir]}_${frame}`];
          const x = px(c);
          const y = py(c);
          ctx.globalAlpha = c.alpha;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(Math.round(x - img.width / SCALE / 2) + 1, Math.round(y - img.height / SCALE / 2) + 2, img.width / SCALE, img.height / SCALE);
          ctx.globalAlpha = c.alpha;
          blit(ctx, img, Math.round(x - img.width / SCALE / 2), Math.round(y - img.height / SCALE / 2));
          if (c.stun > 0) {
            for (let i = 0; i < 3; i++) {
              const a = this.time * 6 + (i * Math.PI * 2) / 3;
              ctx.fillStyle = '#ffd36b';
              ctx.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y - 10 + Math.sin(a) * 3), 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        },
      });
    }
    ents.push({
      y: py(this.player) + 0.1,
      draw: () => {
        const p = this.player;
        if (this.phase === 'caught') {
          // piscando enquanto é pego
          if (Math.floor(this.phaseT * 10) % 2 === 0) return;
        } else if (this.invuln > 0 && Math.floor(this.time * 14) % 2 === 0) return;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.round(px(p)), Math.round(py(p)), 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        const moving = this.phase === 'play' && !(this.hidden && p.off === 0);
        const frame = moving ? Math.floor(this.time * 10) % 2 : 0;
        const img = hd[`moto_${dirKey[p.dir]}_${frame}`];
        const x = px(p);
        const y = py(p);
        ctx.globalAlpha = this.hidden ? 0.5 : 1;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(Math.round(x - img.width / SCALE / 2) + 1, Math.round(y - img.height / SCALE / 2) + 2, img.width / SCALE, img.height / SCALE);
        blit(ctx, img, Math.round(x - img.width / SCALE / 2), Math.round(y - img.height / SCALE / 2));
        if (this.job?.stage === 'drop') {
          const bx = Math.round(x - DX[p.dir] * 3 - 3);
          const by = Math.round(y - DY[p.dir] * 3 - 5);
          ctx.fillStyle = '#1b1220';
          ctx.fillRect(bx - 1, by - 1, 8, 8);
          ctx.fillStyle = CARGO_COLOR[this.job.kind];
          ctx.fillRect(bx, by, 6, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(bx, by, 6, 1);
        }
        ctx.globalAlpha = 1;
        if (this.shield) {
          ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 8);
          ctx.strokeStyle = '#7fe3ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(Math.round(x), Math.round(y), 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      },
    });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    // partículas
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // helicóptero
    const h = this.heli;
    if (h) {
      ctx.globalAlpha = 0.28 * h.alpha;
      const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, HELI_LIGHT);
      g.addColorStop(0, 'rgba(255,244,190,0.9)');
      g.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x, h.y, HELI_LIGHT, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = h.alpha;
      const img = hd[`heli_${Math.floor(this.time * 14) % 3}`];
      blit(ctx, img, Math.round(h.x - img.width / SCALE / 2), Math.round(h.y - img.height / SCALE / 2 - 6));
      ctx.globalAlpha = 1;
    }

    // popups
    for (const p of this.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
      drawPixelText(ctx, p.text, p.x, p.y - p.t * 14, p.color, 1);
    }
    ctx.globalAlpha = 1;

    // faixas
    const banner = (text: string, color: string) => {
      drawPixelText(ctx, text, Math.round(W / 2 - textWidth(text, 3) / 2), Math.round(H / 2 - 40), color, 3);
    };
    if (this.phase === 'caught') banner('PEGO!', '#ff4d5e');
    else if (this.phase === 'ready') banner('PRONTO', '#ffd36b');
  }
}
