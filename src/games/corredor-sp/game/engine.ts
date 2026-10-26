/** Motor do Corredor SP: física da moto, trânsito, itens, perigos, pseudo-3D e HUD. */
import { sfx } from './sound';
import type { Assets } from './assets';
import { hires, mip, SPRITE_SCALE, warmUp } from './hires';
import {
  BLUE_HALF,
  BLUE_LANE,
  CAM_DEPTH,
  CAM_H,
  CENTRIFUGAL,
  CORRIDOR_TOL,
  CORRIDORS,
  CRASH_TIME,
  DAY_CYCLE,
  DESPAWN_BEHIND,
  DRAW_DIST,
  FOG_START,
  GRAU_ACCEL,
  GRAU_CHARGE_BLUE,
  GRAU_CHARGE_CORRIDOR,
  GRAU_DRAIN,
  GRAU_ITEM,
  GRAU_SPEED,
  GRAU_START,
  GRAU_STEER,
  H,
  HELMET_RANGE,
  HELMET_SPEED,
  INVULNERABLE_TIME,
  K,
  KMH,
  METERS_PER_POINT,
  UNITS_PER_METER,
  LANES,
  LEVEL_TIME,
  MAX_HELMETS,
  MAX_LIVES,
  MIN_OBJ_W,
  OFFROAD_LIMIT,
  OFFROAD_SPEED,
  PLAYER_DRAW_SCALE,
  PLAYER_HALF_W,
  PLAYER_LEN,
  PLAYER_Z,
  ROAD_W,
  SEG_LEN,
  SPAWN_AHEAD_MAX,
  SPAWN_AHEAD_MIN,
  TRAFFIC_MAX,
  TRAFFIC_RAMP,
  TRAFFIC_START,
  SPEED_ITEM_FACTOR,
  SPEED_ITEM_TIME,
  SPRITE_UNITS,
  START_LIVES,
  W,
} from './constants';
import { BREEDS, CATEGORIES, COLORS, TRACKS, type BreedId, type CategoryId, type MotoModel, type TrackId, type VehicleKind } from './data';
import type { Input } from './input';
import { drawText, textWidth } from './pixelFont';
import { loadRecord, saveRecord } from './record';
import { buildTrack, segmentAt, type Track } from './road';
import { carSprite, laneBusy, makeVehicle, startLaneChange, updateVehicle, type Vehicle } from './traffic';

export interface RaceConfig {
  track: TrackId;
  breed: BreedId;
  category: CategoryId;
  model: MotoModel;
  color: string;
}

export interface HudState {
  phase: 'countdown' | 'racing' | 'over';
  paused: boolean;
  points: number;
  time: number;
  packages: number;
  meters: number;
  level: number;
  record: number;
  newRecord: boolean;
  overtakes: number;
}

export type ItemKind = 'pacote' | 'vida' | 'velocidade' | 'grau' | 'capacete';
export type HazardKind = 'buraco' | 'cone';

/** Foto do estado para o gancho dos testes de ponta a ponta (`game/e2eHook.ts`). Distâncias `dz` relativas à moto. */
export interface CorredorSnapshot {
  phase: HudState['phase'];
  paused: boolean;
  countdown: number;
  track: TrackId;
  model: { id: string; vmax: number; accel: number; brake: number; steer: number };
  time: number;
  points: number;
  meters: number;
  packages: number;
  level: number;
  record: number;
  overtakes: number;
  player: { x: number; vx: number; speed: number; kmh: number; lives: number; helmets: number; grau: number; grauOn: boolean; crashT: number; invul: number; boostT: number; wobble: number };
  /** Teclas/botões vistos pelo motor (o que a tela entregou). */
  input: { up: boolean; down: boolean; left: boolean; right: boolean; grau: boolean; autoAccel: boolean };
  rain: { on: boolean; timer: number };
  night: number;
  dayT: number;
  vehicles: { id: number; kind: VehicleKind; x: number; lane: number; dz: number; kmh: number; state: string; blink: number; hazard: boolean; len: number; halfW: number; removable: boolean }[];
  items: { kind: ItemKind; x: number; dz: number }[];
  hazards: { kind: HazardKind; x: number; dz: number; hit: boolean }[];
  helmetsFlying: { x: number; dz: number; bouncing: boolean }[];
  /** Veículos que surgiram no turno, por tipo (sorteio do trânsito comum, inicial incluído). */
  spawned: Partial<Record<VehicleKind, number>>;
  banner: string | null;
  popups: string[];
}
interface Item {
  kind: ItemKind;
  z: number;
  x: number;
}
interface Hazard {
  kind: HazardKind;
  z: number;
  x: number;
  flyT: number;
}
interface Helmet {
  z: number;
  x: number;
  speed: number;
  dist: number;
  bounce: number;
}
interface Puff {
  z: number;
  x: number;
  t: number;
}
interface Popup {
  text: string;
  color: string;
  t: number;
}
interface Proj {
  x1: number;
  y1: number;
  w1: number;
  s1: number;
  x2: number;
  y2: number;
  w2: number;
  s2: number;
  clip: number;
  ok: boolean;
}
interface DrawnVehicle {
  v: Vehicle;
  dx: number;
  dy: number;
  f: number;
  clip: number;
  alpha: number;
}

type Rng = () => number;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
function hexRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
/** Cor `hex` misturada com a névoa `fog` na fração t. */
function fogged(hex: string, fog: number[], t: number): string {
  if (t <= 0) return hex;
  const c = hexRgb(hex);
  return `rgb(${lerp(c[0], fog[0], t) | 0},${lerp(c[1], fog[1], t) | 0},${lerp(c[2], fog[2], t) | 0})`;
}
/** Névoa do segmento n (0 perto, até 0,85 no fim da distância de desenho). */
const fogAt = (n: number) => clamp((n / DRAW_DIST - FOG_START) / (1 - FOG_START), 0, 1) * 0.85;
/** Pixels de tela por pixel de sprite, dado o fator de projeção do segmento. */
const PXF = (W / 2) * SPRITE_UNITS;

/** Céu ao longo do dia: [momento do ciclo, topo, meio, horizonte]. */
const SKY: [number, string, string, string][] = [
  [0, '#4a3a7a', '#c4555a', '#f5b860'],
  [0.25, '#2e1f4f', '#8f3a62', '#e98a55'],
  [0.4, '#0e0b1e', '#1b1638', '#2e1f4f'],
  [0.7, '#0e0b1e', '#1b1638', '#2e1f4f'],
  [0.85, '#3d6e9e', '#9cc3e6', '#f4e3b0'],
  [1, '#4a3a7a', '#c4555a', '#f5b860'],
];

const ITEM_WEIGHTS: [ItemKind, number][] = [
  ['pacote', 55],
  ['capacete', 15],
  ['grau', 15],
  ['velocidade', 10],
  ['vida', 5],
];

export class CorredorEngine {
  private readonly track: Track;
  private readonly info = TRACKS[0];
  private pos = 0;
  private player = { x: 0, vx: 0, speed: 0, crashT: 0, invul: 0, lives: START_LIVES, helmets: 0, grau: GRAU_START, grauOn: false, boostT: 0, wobble: 0 };
  private phase: HudState['phase'] = 'countdown';
  private paused = false;
  private countdown = 3;
  private time = 0;
  private packages = 0;
  private meters = 0;
  private level = 1;
  private overtakes = 0;
  private record: number;
  private overT = 0;
  private vehicles: Vehicle[] = [];
  private items: Item[] = [];
  private hazards: Hazard[] = [];
  private helmetsFlying: Helmet[] = [];
  private puffs: Puff[] = [];
  private popups: Popup[] = [];
  private banner: { text: string; color: string; t: number } | null = null;
  private skyOffset = 0;
  private rain = { on: false, timer: 70 };
  private timers = { item: 2, buraco: 6, cone: 10, contramao: 30, ambulancia: 50 };
  private trainZ = 0;
  private clock = 0;
  private drawn: DrawnVehicle[] = [];
  private lamps: { x: number; y: number; f: number }[] = [];
  private lastHud = '';
  private fogRgb: number[] = [245, 184, 96];
  private prevGrau = false;
  private prevCount = 4;
  /** Contagem de veículos surgidos por tipo (leitura dos testes). */
  private spawned: Partial<Record<VehicleKind, number>> = {};
  /** Testes: sem trânsito, itens e perigos novos (pré-condição isolada, só via gancho). */
  private calm = false;

  constructor(
    private readonly assets: Assets,
    private readonly cfg: RaceConfig,
    private readonly input: Input,
    private readonly onHud: (h: HudState) => void,
    private readonly rand: Rng = Math.random,
  ) {
    this.track = buildTrack(cfg.track);
    this.info = TRACKS.find((t) => t.id === cfg.track) ?? TRACKS[0];
    this.record = loadRecord(cfg.track);
    this.trainZ = PLAYER_Z + 8000;
    const moto = `motos/${cfg.breed}_${cfg.category}`;
    warmUp(assets, [
      `horizonte/${cfg.track}_dia`,
      `horizonte/${cfg.track}_noite`,
      ...['reto', 'esq', 'dir', 'grau', 'queda'].map((f) => `${moto}_${f}|${cfg.color}`),
    ]);
    // trânsito inicial espalhado à frente
    for (let i = 0; i < TRAFFIC_START; i++) this.spawnVehicle(this.pickKind(), PLAYER_Z + 3000 + this.rand() * 30000);
    this.emit();
  }

  // ================================================================ estado

  get points() {
    return (Math.floor(this.time) + Math.floor(this.meters / METERS_PER_POINT)) * (1 + this.packages);
  }

  setPaused(p: boolean) {
    if (this.phase === 'over') return;
    this.paused = p;
    if (p) sfx.silence();
    this.input.clear();
    this.emit();
  }
  get isPaused() {
    return this.paused;
  }

  /** Chame ao desmontar a tela: cala o motor e os sons contínuos. */
  dispose() {
    sfx.silence();
  }

  private get playerZ() {
    return this.pos + PLAYER_Z;
  }
  private get trafficFactor() {
    return Math.min(1.6, 1 + 0.06 * (this.level - 1));
  }
  private get dayT() {
    return ((this.time / DAY_CYCLE) % 1 + 1) % 1;
  }
  private get night() {
    const t = this.dayT;
    if (t < 0.15) return 0;
    if (t < 0.35) return (t - 0.15) / 0.2;
    if (t < 0.7) return 1;
    if (t < 0.85) return 1 - (t - 0.7) / 0.15;
    return 0;
  }
  private vmaxKmh() {
    return this.cfg.model.vmax * (this.player.grauOn ? GRAU_SPEED : 1) * (this.player.boostT > 0 ? SPEED_ITEM_FACTOR : 1);
  }

  // ================================================================ update

  update(dtRaw: number) {
    const dt = Math.max(0, Math.min(dtRaw, 0.05));
    this.clock += dt;
    if (this.paused) return;
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    for (const p of this.popups) p.t -= dt;
    this.popups = this.popups.filter((p) => p.t > 0);
    for (const p of this.puffs) p.t += dt;
    this.puffs = this.puffs.filter((p) => p.t < 0.5);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.prevCount && c > 0) sfx.countBeep(false);
      this.prevCount = c;
      this.audio();
      if (this.countdown <= 0) {
        this.phase = 'racing';
        sfx.countBeep(true);
        this.showBanner('VAI!', '#5fd17a', 0.8);
        this.emit();
      }
      return;
    }
    if (this.phase === 'over') {
      this.overT += dt;
      this.player.speed = Math.max(0, this.player.speed - 3000 * dt);
      this.pos += this.player.speed * dt;
      this.updateTraffic(dt);
      return;
    }

    this.time += dt;
    const lvl = 1 + Math.floor(this.time / LEVEL_TIME);
    if (lvl > this.level) {
      this.level = lvl;
      const names = ['', '', 'TRÂNSITO PESADO', 'HORA DO RUSH', 'MARGINAL TRAVADA', 'CAOS TOTAL'];
      sfx.levelUp();
      this.showBanner(`NÍVEL ${lvl}${names[Math.min(lvl, names.length - 1)] ? ' · ' + names[Math.min(lvl, names.length - 1)] : ''}`, '#ffd36b', 2.5);
    }
    this.updateWeather(dt);
    const posBefore = this.pos;
    this.updatePlayer(dt);
    this.meters += Math.max(0, this.pos - posBefore) / UNITS_PER_METER;
    this.updateSpawns(dt);
    this.updateTraffic(dt);
    this.updateHelmets(dt);
    this.checkCollisions();
    this.audio();
    this.emit();
  }

  /** Sons contínuos: motor, terra, garoa, turbo e sirene da ambulância. */
  private audio() {
    const p = this.player;
    const top = this.vmaxKmh() * KMH;
    const alive = p.crashT <= 0;
    const offroad = Math.abs(p.x) > 1.02;
    sfx.drive({
      speed: p.speed / top,
      throttle: this.input.up && alive,
      grau: p.grauOn,
      boost: p.boostT > 0,
      offroad: offroad && alive,
      rain: this.rain.on,
      // corte de giro ao chegar na velocidade máxima, com o acelerador pressionado
      limiter: alive && !offroad && this.input.up && p.speed >= top * 0.985,
    });
    if (p.grauOn && !this.prevGrau) sfx.grauOn();
    this.prevGrau = p.grauOn;
    const pz = this.playerZ;
    const amb = this.vehicles.find((v) => v.kind === 'ambulancia' && Math.abs(v.z - pz) < 22000);
    sfx.siren(amb ? 1 - Math.abs(amb.z - pz) / 22000 : 0);
  }

  private showBanner(text: string, color: string, t = 2) {
    this.banner = { text, color, t };
  }

  private popup(text: string, color = '#ffd36b') {
    this.popups.push({ text, color, t: 1 });
    if (this.popups.length > 3) this.popups.shift();
  }

  private updateWeather(dt: number) {
    this.rain.timer -= dt;
    if (this.rain.timer <= 0) {
      this.rain.on = !this.rain.on;
      this.rain.timer = this.rain.on ? 25 + this.rand() * 15 : 50 + this.rand() * 60;
      if (this.rain.on) sfx.rainStart();
      if (this.rain.on) this.showBanner('GAROA: PISTA ESCORREGADIA', '#9cc3e6', 2.2);
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const m = this.cfg.model;
    const seg = segmentAt(this.track, this.playerZ);
    if (p.invul > 0) p.invul -= dt;
    if (p.boostT > 0) p.boostT -= dt;
    if (p.wobble > 0) p.wobble -= dt;

    if (p.crashT > 0) {
      p.crashT -= dt;
      p.speed = Math.max(0, p.speed - 4000 * dt);
      p.grauOn = false;
      this.pos += p.speed * dt;
      if (p.crashT <= 0) {
        if (p.lives <= 0) {
          this.endRace();
        } else {
          p.invul = INVULNERABLE_TIME;
          p.x = clamp(p.x, -0.9, 0.9);
          p.vx = 0;
          // tira da frente quem estiver em cima da moto
          this.vehicles = this.vehicles.filter((v) => !(Math.abs(v.z - this.playerZ) < 900 && Math.abs(v.x - p.x) < v.halfW + 0.2));
        }
      }
      return;
    }

    const throwNow = this.input.takeThrow();
    if (throwNow && p.helmets > 0) {
      p.helmets--;
      this.helmetsFlying.push({ z: this.playerZ + 150, x: p.x, speed: p.speed + HELMET_SPEED, dist: 0, bounce: 0 });
      sfx.throwHelmet();
    }

    // grau
    const base = m.vmax * KMH;
    p.grauOn = this.input.grau && p.grau > 0 && p.speed > base * 0.3;
    if (p.grauOn) p.grau = Math.max(0, p.grau - GRAU_DRAIN * dt);

    const offroad = Math.abs(p.x) > 1.02;
    const vmax = this.vmaxKmh() * KMH * (offroad ? OFFROAD_SPEED : 1);
    const accel = m.accel * KMH * (p.grauOn ? GRAU_ACCEL : 1);
    const brake = m.brake * KMH * (this.rain.on ? 0.75 : 1);
    if (this.input.down) p.speed -= brake * dt;
    else if (this.input.up) p.speed += accel * dt * Math.max(0.15, 1 - 0.6 * (p.speed / Math.max(1, vmax)));
    else p.speed -= accel * 0.35 * dt;
    if (p.speed > vmax) p.speed = Math.max(vmax, p.speed - accel * 2.5 * dt);
    p.speed = Math.max(0, p.speed);

    // direção com inércia (a garoa reduz a aderência)
    const speedPct = clamp(p.speed / base, 0, 1.3);
    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const maxLat = m.steer * (p.grauOn ? GRAU_STEER : 1) * Math.min(1, 0.35 + speedPct);
    const grip = this.rain.on ? 3 : 9;
    p.vx += (dir * maxLat - p.vx) * Math.min(1, grip * dt);
    if (p.wobble > 0) p.vx += Math.sin(this.clock * 40) * 0.8 * dt * 10;
    p.x += p.vx * dt;
    p.x -= dt * speedPct * speedPct * seg.curve * CENTRIFUGAL;
    p.x = clamp(p.x, -OFFROAD_LIMIT, OFFROAD_LIMIT);

    this.pos += p.speed * dt;
    this.skyOffset += seg.curve * speedPct * dt * 6;
  }

  private crash() {
    const p = this.player;
    if (p.crashT > 0 || p.invul > 0) return;
    p.crashT = CRASH_TIME;
    p.lives--;
    sfx.crash();
    if (p.lives > 0) sfx.skid();
    this.showBanner(p.lives > 0 ? 'BATEU!' : 'FIM DE TURNO', '#ff4d5e', 1.6);
  }

  private endRace() {
    this.phase = 'over';
    sfx.silence();
    sfx.gameOver(this.points > this.record);
    if (this.points > this.record) saveRecord(this.cfg.track, this.points);
    this.emit();
  }

  // ------------------------------------------------------------ spawns
  private pickKind(): VehicleKind {
    const weights = Object.entries(this.info.traffic) as [VehicleKind, number][];
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = this.rand() * total;
    for (const [k, w] of weights) {
      r -= w;
      if (r <= 0) return k;
    }
    return 'carro';
  }

  private spriteFor(kind: VehicleKind): { key: string; w: number } {
    const a = this.assets;
    let key: string;
    switch (kind) {
      case 'carro':
        key = carSprite(this.rand);
        break;
      case 'moto': {
        const b = BREEDS[Math.floor(this.rand() * BREEDS.length)].id;
        const c = CATEGORIES[Math.floor(this.rand() * CATEGORIES.length)].id;
        const col = COLORS[Math.floor(this.rand() * COLORS.length)].hex;
        key = `motos/${b}_${c}_reto|${col}`;
        return { key, w: 26 };
      }
      case 'contramao':
        key = 'transito/moto_contramao';
        return { key, w: 26 };
      case 'ambulancia':
        key = 'transito/ambulancia_0';
        break;
      default:
        key = `transito/${kind}`;
    }
    return { key, w: a[key].width };
  }

  private spawnVehicle(kind: VehicleKind, z: number): boolean {
    let lane = -1;
    let x: number;
    if (kind === 'moto' || kind === 'contramao') {
      x = kind === 'contramao' || this.rand() < 0.75 ? CORRIDORS[Math.floor(this.rand() * CORRIDORS.length)] : LANES[Math.floor(this.rand() * 4)];
      if (kind === 'moto' && this.rand() < 0.4) x = BLUE_LANE;
    } else {
      const options = kind === 'onibus' ? [3] : kind === 'caminhao' ? [2, 3] : [0, 1, 2, 3];
      const free = options.filter((l) => !laneBusy(this.vehicles, l, z, 2000, 2000));
      if (!free.length) return false;
      lane = free[Math.floor(this.rand() * free.length)];
      x = LANES[lane];
    }
    const s = this.spriteFor(kind);
    this.vehicles.push(makeVehicle(kind, z, x, lane, this.trafficFactor, this.rand, s.w, s.key));
    this.spawned[kind] = (this.spawned[kind] ?? 0) + 1;
    return true;
  }

  private updateSpawns(dt: number) {
    if (this.calm) return;
    const pz = this.playerZ;
    // densidade sobe aos poucos desde o início do turno até o teto
    const target = Math.round(TRAFFIC_START + (TRAFFIC_MAX - TRAFFIC_START) * Math.min(1, this.time / TRAFFIC_RAMP));
    const around = this.vehicles.filter((v) => v.z - pz > -1500 && v.z - pz < SPAWN_AHEAD_MAX && v.kind !== 'ambulancia' && v.kind !== 'contramao').length;
    for (let i = 0; i < 2 && around + i < target; i++) {
      const kind = this.pickKind();
      const behind = kind === 'moto' && this.rand() < 0.3 && this.player.speed < 90 * KMH;
      this.spawnVehicle(kind, behind ? pz - 2500 : pz + SPAWN_AHEAD_MIN + this.rand() * (SPAWN_AHEAD_MAX - SPAWN_AHEAD_MIN));
    }

    const t = this.timers;
    t.item -= dt;
    if (t.item <= 0) {
      t.item = 1.8 + this.rand() * 1.4;
      const total = ITEM_WEIGHTS.reduce((s, [, w]) => s + w, 0);
      let r = this.rand() * total;
      let kind: ItemKind = 'pacote';
      for (const [k, w] of ITEM_WEIGHTS) {
        r -= w;
        if (r <= 0) {
          kind = k;
          break;
        }
      }
      if (kind === 'vida' && this.player.lives >= MAX_LIVES) kind = 'pacote';
      const spots = [...LANES, ...CORRIDORS];
      this.items.push({ kind, z: pz + SPAWN_AHEAD_MIN, x: spots[Math.floor(this.rand() * spots.length)] });
    }
    t.buraco -= dt;
    if (t.buraco <= 0) {
      t.buraco = Math.max(3, 9 - this.level) + this.rand() * 3;
      this.hazards.push({ kind: 'buraco', z: pz + SPAWN_AHEAD_MIN, x: LANES[Math.floor(this.rand() * 4)] + (this.rand() - 0.5) * 0.2, flyT: 0 });
    }
    t.cone -= dt;
    if (t.cone <= 0) {
      t.cone = Math.max(5, 14 - this.level) + this.rand() * 4;
      const x = LANES[Math.floor(this.rand() * 4)];
      for (let k = 0; k < 3; k++) this.hazards.push({ kind: 'cone', z: pz + SPAWN_AHEAD_MIN + k * 250, x: x + (k - 1) * 0.08, flyT: 0 });
    }
    if (this.level >= 2) {
      t.contramao -= dt;
      if (t.contramao <= 0) {
        t.contramao = Math.max(14, 40 - 4 * this.level) + this.rand() * 10;
        this.spawnVehicle('contramao', pz + 22000);
      }
      t.ambulancia -= dt;
      if (t.ambulancia <= 0) {
        t.ambulancia = Math.max(30, 70 - 5 * this.level) + this.rand() * 15;
        const lane = Math.floor(this.rand() * 4);
        const s = this.spriteFor('ambulancia');
        this.vehicles.push(makeVehicle('ambulancia', pz - 6000, LANES[lane], lane, 1, this.rand, s.w, s.key));
      }
    }
    // trem do metrô ao lado da Radial Leste
    if (this.cfg.track === 'radial-leste') {
      this.trainZ += 80 * KMH * dt;
      if (this.trainZ + 3 * 820 < pz - 3000) this.trainZ = pz + 20000 + this.rand() * 6000;
    }
  }

  private updateTraffic(dt: number) {
    const pz = this.playerZ;
    const params = {
      speedFactor: this.trafficFactor,
      laneChangeRate: 0.04 + 0.01 * this.level,
      noSignalChance: Math.min(0.08 + 0.05 * (this.level - 1), 0.5),
    };
    const playerRef = { z: pz, x: this.player.x };
    for (const v of this.vehicles) updateVehicle(v, this.vehicles, dt, params, this.rand, playerRef);

    // ambulância: carros à frente dela abrem passagem
    for (const amb of this.vehicles) {
      if (amb.kind !== 'ambulancia') continue;
      for (const v of this.vehicles) {
        if (v === amb || v.kind === 'moto' || v.kind === 'contramao' || v.kind === 'ambulancia' || v.state !== 'normal') continue;
        const dz = v.z - amb.z;
        if (dz <= 0 || dz > 4500 || Math.abs(v.x - amb.x) > 0.3) continue;
        const opts = [v.lane - 1, v.lane + 1].filter((l) => l >= 0 && l <= 3 && !laneBusy(this.vehicles, l, v.z, 1200, 1200, v));
        if (opts.length) startLaneChange(v, opts[0], false, true);
      }
    }

    // ultrapassagens (carregam o grau no corredor)
    const p = this.player;
    const corridor = CORRIDORS.find((c) => Math.abs(p.x - c) < CORRIDOR_TOL);
    for (const v of this.vehicles) {
      const dz = v.z - pz;
      if (this.phase === 'racing' && p.crashT <= 0 && v.prevDz > 0 && dz <= 0 && v.kind !== 'contramao' && v.state !== 'spinout') {
        this.overtakes++;
        if (Math.abs(v.x - p.x) < 0.5) sfx.overtake(clamp((v.x - p.x) * 2, -1, 1));
        if (corridor !== undefined) {
          const gain = corridor === BLUE_LANE ? GRAU_CHARGE_BLUE : GRAU_CHARGE_CORRIDOR;
          p.grau = Math.min(1, p.grau + gain);
        }
      }
      v.prevDz = dz;
    }
    this.vehicles = this.vehicles.filter((v) => {
      const dz = v.z - pz;
      if (v.state === 'spinout' && v.spin > 0.9) return false;
      if (v.kind === 'ambulancia') return dz > -9000 && dz < 32000;
      return dz > -DESPAWN_BEHIND && dz < SPAWN_AHEAD_MAX + 4000;
    });
    this.items = this.items.filter((i) => i.z - pz > -DESPAWN_BEHIND);
    this.hazards = this.hazards.filter((h) => h.z - pz > -DESPAWN_BEHIND && h.flyT < 0.8);
    for (const h of this.hazards) if (h.flyT > 0) h.flyT += dt;
  }

  private updateHelmets(dt: number) {
    for (const h of this.helmetsFlying) {
      if (h.bounce > 0) {
        h.bounce += dt;
        h.z += 400 * dt;
        continue;
      }
      const prev = h.z;
      h.z += h.speed * dt;
      h.dist += h.speed * dt;
      // primeiro alvo atravessado neste quadro
      let hit: Vehicle | null = null;
      for (const v of this.vehicles) {
        if (v.state === 'spinout') continue;
        const back = v.z - v.len / 2;
        if (Math.abs(v.x - h.x) > v.halfW + 0.04) continue;
        if (back <= h.z && v.z + v.len / 2 >= prev && (!hit || v.z < hit.z)) hit = v;
      }
      const cone = this.hazards.find((c) => c.kind === 'cone' && c.flyT === 0 && Math.abs(c.x - h.x) < 0.08 && c.z >= prev && c.z <= h.z);
      if (cone && (!hit || cone.z < hit.z)) {
        cone.flyT = 0.01;
        h.dist = HELMET_RANGE + 1;
        this.popup('CONE LONGE!', '#ff8a2a');
        sfx.coneHit();
      } else if (hit) {
        if (hit.removable) {
          hit.state = 'spinout';
          hit.blink = 0;
          this.puffs.push({ z: hit.z, x: hit.x, t: 0 });
          h.dist = HELMET_RANGE + 1;
          this.popup('CAPACETADA!', '#ff4d5e');
          sfx.helmetHit();
        } else {
          h.bounce = 0.01;
          h.z = hit.z - hit.len / 2;
          this.popup('TOC! GRANDE DEMAIS', '#c9c0d8');
          sfx.helmetBounce();
        }
      }
    }
    this.helmetsFlying = this.helmetsFlying.filter((h) => (h.bounce > 0 ? h.bounce < 0.5 : h.dist < HELMET_RANGE));
  }

  private checkCollisions() {
    const p = this.player;
    const pz = this.playerZ;
    // itens (mesmo invulnerável)
    this.items = this.items.filter((it) => {
      if (Math.abs(it.z - pz) > 260 || Math.abs(it.x - p.x) > 0.12 || p.crashT > 0) return true;
      this.collect(it.kind);
      return false;
    });
    if (p.crashT > 0 || p.invul > 0) return;
    const fast = p.speed > this.cfg.model.vmax * KMH * 0.55;
    for (const h of this.hazards) {
      if (h.flyT > 0) continue;
      const dz = Math.abs(h.z - pz);
      if (h.kind === 'buraco' && dz < 200 && Math.abs(h.x - p.x) < 0.1) {
        if (fast) return this.crash();
        p.speed *= 0.6;
        p.wobble = 0.6;
        h.flyT = 0.79; // some logo
        this.popup('BURACO!', '#ff8a2a');
        sfx.pothole();
      }
      if (h.kind === 'cone' && dz < 150 && Math.abs(h.x - p.x) < 0.07) {
        p.speed *= 0.7;
        h.flyT = 0.01;
        sfx.coneRun();
      }
    }
    for (const v of this.vehicles) {
      if (v.state === 'spinout') continue;
      const dz = v.z - pz;
      if (v.kind === 'moto' && dz < 0) continue; // motos que vêm por trás desviam
      if (Math.abs(dz) < (v.len + PLAYER_LEN) / 2 && Math.abs(v.x - p.x) < v.halfW + PLAYER_HALF_W) return this.crash();
    }
  }

  private collect(kind: ItemKind) {
    const p = this.player;
    sfx.pickup(kind);
    switch (kind) {
      case 'pacote':
        this.packages++;
        this.popup('+1 PACOTE');
        break;
      case 'vida':
        p.lives = Math.min(MAX_LIVES, p.lives + 1);
        this.popup('+1 VIDA', '#ff8a96');
        break;
      case 'velocidade':
        p.boostT = SPEED_ITEM_TIME;
        this.popup('VELOCIDADE!', '#9fe0ff');
        break;
      case 'grau':
        p.grau = Math.min(1, p.grau + GRAU_ITEM);
        this.popup('+GRAU', '#5fd17a');
        break;
      case 'capacete':
        // com 3 guardados o item pode ser pego, mas não muda nada
        if (p.helmets < MAX_HELMETS) {
          p.helmets++;
          this.popup('+1 CAPACETE', '#f4efe2');
        }
        break;
    }
  }

  // ================================================================ testes de ponta a ponta

  /** Estado para o gancho dos testes (só leitura). */
  e2eState(): CorredorSnapshot {
    const p = this.player;
    const pz = this.playerZ;
    const m = this.cfg.model;
    const i = this.input;
    return {
      phase: this.phase,
      paused: this.paused,
      countdown: this.countdown,
      track: this.cfg.track,
      model: { id: m.id, vmax: m.vmax, accel: m.accel, brake: m.brake, steer: m.steer },
      time: this.time,
      points: this.points,
      meters: this.meters,
      packages: this.packages,
      level: this.level,
      record: this.record,
      overtakes: this.overtakes,
      player: { x: p.x, vx: p.vx, speed: p.speed, kmh: p.speed / KMH, lives: p.lives, helmets: p.helmets, grau: p.grau, grauOn: p.grauOn, crashT: p.crashT, invul: p.invul, boostT: p.boostT, wobble: p.wobble },
      input: { up: i.up, down: i.down, left: i.left, right: i.right, grau: i.grau, autoAccel: i.autoAccel },
      rain: { on: this.rain.on, timer: this.rain.timer },
      night: this.night,
      dayT: this.dayT,
      vehicles: this.vehicles.map((v) => ({ id: v.id, kind: v.kind, x: v.x, lane: v.lane, dz: v.z - pz, kmh: v.speed / KMH, state: v.state, blink: v.blink, hazard: v.hazard, len: v.len, halfW: v.halfW, removable: v.removable })),
      items: this.items.map((it) => ({ kind: it.kind, x: it.x, dz: it.z - pz })),
      hazards: this.hazards.map((h) => ({ kind: h.kind, x: h.x, dz: h.z - pz, hit: h.flyT > 0 })),
      helmetsFlying: this.helmetsFlying.map((h) => ({ x: h.x, dz: h.z - pz, bouncing: h.bounce > 0 })),
      spawned: { ...this.spawned },
      banner: this.banner?.text ?? null,
      popups: this.popups.map((pp) => pp.text),
    };
  }

  /** Testes: põe um veículo a `dz` da moto (faixa 0–3 para quatro rodas; `x` livre para motos). */
  e2eSpawnVehicle(kind: VehicleKind, where: { lane?: number; x?: number }, dz: number, kmh?: number) {
    const lane = kind === 'moto' || kind === 'contramao' ? -1 : (where.lane ?? 0);
    const x = where.x ?? (lane >= 0 ? LANES[lane] : 0);
    const s = this.spriteFor(kind);
    const v = makeVehicle(kind, this.playerZ + dz, x, lane, this.trafficFactor, this.rand, s.w, s.key);
    if (kmh !== undefined) v.speed = v.desired = kmh * KMH * (kind === 'contramao' ? -1 : 1);
    this.vehicles.push(v);
    return v.id;
  }

  /** Testes: põe um item ou perigo a `dz` da moto, na posição lateral `x`. */
  e2eSpawnThing(kind: ItemKind | HazardKind, x: number, dz: number) {
    const z = this.playerZ + dz;
    if (kind === 'buraco' || kind === 'cone') this.hazards.push({ kind, z, x, flyT: 0 });
    else this.items.push({ kind, z, x });
  }

  /** Testes: tira trânsito, itens e perigos e para de criar novos (`on = false` volta ao normal). */
  e2eCalm(on: boolean) {
    this.calm = on;
    if (on) {
      this.vehicles = [];
      this.items = [];
      this.hazards = [];
    }
  }

  /** Testes: leva o cronômetro do turno a `s` segundos (o nível e o dia seguem no próximo quadro). */
  e2eSetTime(s: number) {
    this.time = s;
  }

  /** Testes: troca o estado da garoa no próximo quadro (como o relógio dela faria). */
  e2eToggleRain() {
    this.rain.timer = 0;
  }

  /** Testes: fixa o número de vidas. */
  e2eSetLives(n: number) {
    this.player.lives = n;
  }

  // ================================================================ render

  render(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
    const night = this.night;
    this.drawSky(ctx, night);
    const proj = this.drawRoad(ctx);
    this.drawObjects(ctx, proj);
    if (night > 0) this.drawNight(ctx, night);
    this.drawSignals(ctx, night);
    this.drawPlayer(ctx);
    if (this.rain.on) this.drawRain(ctx);
    this.drawHud(ctx);
  }

  private drawSky(ctx: CanvasRenderingContext2D, night: number) {
    const t = this.dayT;
    let i = 0;
    while (i < SKY.length - 2 && t > SKY[i + 1][0]) i++;
    const [t0, a0, b0, c0] = SKY[i];
    const [t1, a1, b1, c1] = SKY[i + 1];
    const k = clamp((t - t0) / (t1 - t0), 0, 1);
    const midA = hexRgb(b0);
    const midB = hexRgb(b1);
    const botA = hexRgb(c0);
    const botB = hexRgb(c1);
    const topRgb = hexRgb(a0).map((v, j) => lerp(v, hexRgb(a1)[j], k));
    const mid = midA.map((v, j) => lerp(v, midB[j], k));
    const bot = botA.map((v, j) => lerp(v, botB[j], k));
    this.fogRgb = bot;
    for (let y = 0; y < H; y += 2) {
      const u = y / (110 * K);
      const c = u < 0.6 ? topRgb.map((v, j) => lerp(v, mid[j], u / 0.6)) : mid.map((v, j) => lerp(v, bot[j], clamp((u - 0.6) / 0.4, 0, 1)));
      ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      ctx.fillRect(0, y, W, 2);
    }
    if (night > 0.3) {
      ctx.fillStyle = `rgba(244,239,226,${(night - 0.3) * 1.2})`;
      for (let s = 0; s < 80; s++) ctx.fillRect((s * 97 + 13) % W, (s * 37) % (70 * K), s % 7 === 0 ? 2 : 1, s % 7 === 0 ? 2 : 1);
    }
    // horizonte (dia e noite misturados), com paralaxe nas curvas
    const off = ((Math.round(-this.skyOffset * K) % W) + W) % W;
    const by = H / 2 + (6 - 90) * K;
    const day = hires(this.assets, `horizonte/${this.cfg.track}_dia`);
    const nig = hires(this.assets, `horizonte/${this.cfg.track}_noite`);
    for (const [img, alpha] of [
      [day, 1 - night],
      [nig, night],
    ] as const) {
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, off - W, by);
      ctx.drawImage(img, off, by);
      ctx.globalAlpha = 1;
    }
    // chão até a base da tela (aparece atrás das lombadas)
    ctx.fillStyle = fogged(this.rain.on ? '#2f5f2c' : '#376e33', bot, 0.6);
    ctx.fillRect(0, by + 90 * K, W, H - by - 90 * K);
  }

  private drawRoad(ctx: CanvasRenderingContext2D): Proj[] {
    const N = this.track.segments.length;
    const i0 = Math.floor(this.pos / SEG_LEN);
    const basePct = (this.pos % SEG_LEN) / SEG_LEN;
    const playerSeg = segmentAt(this.track, this.playerZ);
    const pPct = (this.playerZ % SEG_LEN) / SEG_LEN;
    const playerY = lerp(playerSeg.y1, playerSeg.y2, pPct);
    const camY = playerY + CAM_H;
    const camX = this.player.x * ROAD_W;
    let maxy = H;
    let x = 0;
    let dx = -(this.track.segments[((i0 % N) + N) % N].curve * basePct);
    const proj: Proj[] = [];
    const rain = this.rain.on;
    const grass = rain ? ['#356a32', '#2f5f2c'] : ['#3f7a3a', '#376e33'];
    const road = rain ? ['#3d3946', '#3a3643'] : ['#4a4552', '#46414e'];
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = this.track.segments[(((i0 + n) % N) + N) % N];
      const z1 = (i0 + n) * SEG_LEN - this.pos;
      const z2 = z1 + SEG_LEN;
      const P: Proj = { x1: 0, y1: 0, w1: 0, s1: 0, x2: 0, y2: 0, w2: 0, s2: 0, clip: maxy, ok: false };
      if (z1 > 1) {
        P.s1 = CAM_DEPTH / z1;
        P.x1 = W / 2 + P.s1 * (-camX - x) * (W / 2);
        P.y1 = H / 2 - P.s1 * (seg.y1 - camY) * (H / 2);
        P.w1 = P.s1 * ROAD_W * (W / 2);
      }
      P.s2 = CAM_DEPTH / z2;
      P.x2 = W / 2 + P.s2 * (-camX - x - dx) * (W / 2);
      P.y2 = H / 2 - P.s2 * (seg.y2 - camY) * (H / 2);
      P.w2 = P.s2 * ROAD_W * (W / 2);
      x += dx;
      dx += seg.curve;
      proj.push(P);
      if (z1 <= CAM_DEPTH || P.y2 >= P.y1 || P.y2 >= maxy) continue;
      P.ok = true;
      const top = Math.max(0, Math.ceil(P.y2));
      const bottom = Math.min(Math.floor(P.y1), maxy - 1);
      const b = seg.band;
      const fg = fogAt(n);
      const fog = this.fogRgb;
      const cGrass = fogged(grass[b], fog, fg);
      const cCurb = fogged('#9a968c', fog, fg);
      const cZebra = fogged(b ? '#d42a2a' : '#f4efe2', fog, fg);
      const cRoad = fogged(road[b], fog, fg);
      const cBlue = fogged(rain ? '#2a5ab0' : '#2f6fd0', fog, fg);
      const cLine = fogged('#f4efe2', fog, fg);
      for (let r = top; r <= bottom; r++) {
        const t = (r - P.y2) / (P.y1 - P.y2 || 1);
        const cx = lerp(P.x2, P.x1, t);
        const w = lerp(P.w2, P.w1, t);
        ctx.fillStyle = cGrass;
        ctx.fillRect(0, r, W, 1);
        ctx.fillStyle = cCurb;
        ctx.fillRect(Math.round(cx - w * 1.16), r, Math.round(w * 2.32), 1);
        ctx.fillStyle = cZebra;
        ctx.fillRect(Math.round(cx - w * 1.08), r, Math.round(w * 2.16), 1);
        ctx.fillStyle = cRoad;
        ctx.fillRect(Math.round(cx - w), r, Math.round(w * 2), 1);
        // faixa azul no corredor da esquerda
        const bw = Math.max(1, w * BLUE_HALF);
        const bc = cx + w * BLUE_LANE;
        ctx.fillStyle = cBlue;
        ctx.fillRect(Math.round(bc - bw), r, Math.max(2, Math.round(bw * 2)), 1);
        const lw = Math.max(1, Math.round(w * 0.02));
        ctx.fillStyle = cLine;
        // bordas da faixa azul: linha contínua (só motos)
        ctx.fillRect(Math.round(bc - bw - lw), r, lw, 1);
        ctx.fillRect(Math.round(bc + bw), r, lw, 1);
        if (b === 0) {
          ctx.fillRect(Math.round(cx + w * CORRIDORS[1] - lw / 2), r, lw, 1);
          ctx.fillRect(Math.round(cx + w * CORRIDORS[2] - lw / 2), r, lw, 1);
        }
      }
      maxy = top;
    }
    return proj;
  }

  /**
   * Desenha um sprite ancorado pela base, recortado pelo relevo. Retorna `f` = pixels de tela por
   * pixel do PNG original (as coordenadas de `LIGHTS` e dos postes usam o original).
   * `minW`: largura mínima na tela, para veículos e itens continuarem legíveis de longe.
   */
  private sprite(ctx: CanvasRenderingContext2D, key: string, sx: number, sy: number, scale: number, clip: number, flip = false, sizeMul = 1, minW = 0) {
    const big = hires(this.assets, key);
    const ow = big.width / SPRITE_SCALE;
    const oh = big.height / SPRITE_SCALE;
    let f = scale * PXF * sizeMul;
    if (minW > 0 && ow * f < minW) f = minW / ow;
    const dw = ow * f;
    const dh = oh * f;
    if (dw < 0.5 || dh < 0.5) return null;
    const dx = Math.round(sx - dw / 2);
    const dy = Math.round(sy - dh);
    const visible = Math.min(dh, clip - dy);
    if (visible <= 0) return null;
    const rw = Math.max(1, Math.round(dw));
    const rh = Math.max(1, Math.round(visible));
    const img = mip(this.assets, key, rw);
    const srcH = (img.height * visible) / dh;
    if (flip) {
      ctx.save();
      ctx.translate(dx + rw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, img.width, srcH, 0, 0, rw, rh);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, img.width, srcH, dx, dy, rw, rh);
    }
    return { dx, dy, f };
  }

  private drawObjects(ctx: CanvasRenderingContext2D, proj: Proj[]) {
    const i0 = Math.floor(this.pos / SEG_LEN);
    const N = this.track.segments.length;
    type Obj = { z: number; draw: (sx: number, sy: number, s: number, w: number, clip: number) => void };
    const buckets: Obj[][] = proj.map(() => []);
    const put = (z: number, draw: Obj['draw']) => {
      const n = Math.floor(z / SEG_LEN) - i0;
      if (n >= 1 && n < proj.length) buckets[n].push({ z, draw });
    };
    this.drawn = [];
    this.lamps = [];

    for (const v of this.vehicles) {
      put(v.z, (sx, sy, s, w, clip) => {
        let key = v.sprite;
        if (v.kind === 'ambulancia') key = `transito/ambulancia_${Math.floor(this.clock * 6) % 2}`;
        const shake = v.state === 'spinout' ? Math.sin(v.spin * 40) * 3 * K : 0;
        const r = this.sprite(ctx, key, sx + v.x * w + shake, sy, s, clip, v.state === 'spinout' && Math.floor(v.spin * 10) % 2 === 0, 1, MIN_OBJ_W);
        if (r) this.drawn.push({ v, dx: r.dx, dy: r.dy, f: r.f, clip, alpha: ctx.globalAlpha });
      });
    }
    for (const it of this.items) put(it.z, (sx, sy, s, w, clip) => this.sprite(ctx, `itens/${it.kind}`, sx + it.x * w, sy - 4 * s * PXF, s, clip, false, 1.4, MIN_OBJ_W * 0.8));
    for (const h of this.hazards) {
      put(h.z, (sx, sy, s, w, clip) =>
        this.sprite(ctx, `cenario/${h.kind}`, sx + (h.x + (h.flyT > 0 ? h.flyT * 1.5 : 0)) * w, sy - (h.flyT > 0 ? h.flyT * 40 * K : 0) + (h.kind === 'buraco' ? 2 * s * PXF : 0), s, clip, false, 1, MIN_OBJ_W * 0.7),
      );
    }
    for (const h of this.helmetsFlying) {
      const frame = Math.floor((this.clock + h.dist / 3000) * 12) % 4;
      put(h.z, (sx, sy, s, w, clip) => this.sprite(ctx, `itens/capacete_voo_${frame}`, sx + h.x * w, sy - 18 * s * PXF * (h.bounce > 0 ? 1 - h.bounce : 1), s, clip, false, 1.6));
    }
    for (const p of this.puffs) {
      put(p.z, (sx, sy, s, w) => {
        ctx.fillStyle = `rgba(244,239,226,${1 - p.t * 2})`;
        const r = Math.max(1, Math.round((6 + p.t * 30) * s * PXF));
        ctx.fillRect(Math.round(sx + p.x * w - r), Math.round(sy - r * 2), r * 2, r * 2);
      });
    }
    if (this.cfg.track === 'radial-leste') {
      for (let k = 0; k < 3; k++) put(this.trainZ + k * 820, (sx, sy, s, w, clip) => this.sprite(ctx, 'cenario/trem_metro', sx - 2.15 * w, sy, s, clip));
    }

    for (let n = proj.length - 1; n >= 1; n--) {
      const P = proj[n];
      if (!P.ok) continue;
      const seg = this.track.segments[(((i0 + n) % N) + N) % N];
      for (const sp of seg.sprites) {
        ctx.globalAlpha = 1 - fogAt(n);
        const r = this.sprite(ctx, sp.key, P.x1 + sp.x * P.w1, P.y1, P.s1, P.clip, sp.flip);
        if (r && sp.key === 'cenario/poste') this.lamps.push({ x: sp.flip ? r.dx + (24 - 17) * r.f : r.dx + 17 * r.f, y: r.dy + 9 * r.f, f: r.f });
      }
      // névoa no fim da distância: objetos aparecem aos poucos em vez de surgirem do nada
      const fg = fogAt(n);
      ctx.globalAlpha = 1 - fg;
      const list = buckets[n].sort((a, b) => b.z - a.z);
      for (const o of list) {
        const pct = (o.z % SEG_LEN) / SEG_LEN;
        const s = lerp(P.s1, P.s2, pct);
        const sx = lerp(P.x1, P.x2, pct);
        const sy = lerp(P.y1, P.y2, pct);
        const w = lerp(P.w1, P.w2, pct);
        o.draw(sx, sy, s, w, P.clip);
      }
      ctx.globalAlpha = 1;
    }
  }

  private playerSprite(): string {
    const p = this.player;
    const base = `motos/${this.cfg.breed}_${this.cfg.category}`;
    let frame = 'reto';
    if (p.crashT > 0) frame = 'queda';
    else if (p.grauOn) frame = 'grau';
    else if (p.vx > 0.35) frame = 'dir';
    else if (p.vx < -0.35) frame = 'esq';
    return `${base}_${frame}|${this.cfg.color}`;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.invul > 0 && Math.floor(this.clock * 10) % 2 === 0) return;
    const img = hires(this.assets, this.playerSprite());
    const s = (PLAYER_DRAW_SCALE * K) / SPRITE_SCALE;
    const dw = Math.round(img.width * s);
    const dh = Math.round(img.height * s);
    const bob = p.speed > 100 && p.crashT <= 0 ? Math.round(Math.sin(this.clock * 28) * K) : 0;
    const slide = p.crashT > 0 ? Math.round((CRASH_TIME - p.crashT) * 18 * K) * (p.x > 0 ? 1 : -1) : 0;
    ctx.drawImage(img, Math.round(W / 2 - dw / 2 + slide), H - dh - 2 * K + bob, dw, dh);
  }

  private drawNight(ctx: CanvasRenderingContext2D, night: number) {
    ctx.fillStyle = `rgba(8,6,24,${0.62 * night})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // farol do jogador
    ctx.fillStyle = `rgba(255,240,180,${0.1 * night})`;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 14 * K, H - 40 * K);
    ctx.lineTo(W / 2 + 14 * K, H - 40 * K);
    ctx.lineTo(W / 2 + 70 * K, H / 2 + 10 * K);
    ctx.lineTo(W / 2 - 70 * K, H / 2 + 10 * K);
    ctx.closePath();
    ctx.fill();
    // postes
    for (const l of this.lamps) {
      const r = Math.max(1, Math.round(4 * l.f));
      ctx.fillStyle = `rgba(255,211,107,${0.5 * night})`;
      ctx.fillRect(Math.round(l.x - r), Math.round(l.y - r / 2), r * 2, r);
    }
    ctx.globalCompositeOperation = 'source-over';
    // lanternas
    for (const d of this.drawn) {
      const v = d.v;
      // à noite as luzes atravessam a névoa: dá para ver os faróis lá longe
      ctx.globalAlpha = Math.min(1, d.alpha + 0.4);
      if (v.kind === 'contramao') {
        ctx.fillStyle = '#fff7c2';
        ctx.fillRect(Math.round(d.dx + 17 * d.f), Math.round(d.dy + 30 * d.f), Math.max(2, Math.round(6 * d.f)), Math.max(2, Math.round(3 * d.f)));
        continue;
      }
      ctx.fillStyle = v.brake ? '#ff6b5e' : '#d9342a';
      for (const [lx, ly, lw, lh] of v.lights) {
        const y = d.dy + ly * d.f;
        if (y > d.clip) continue;
        ctx.fillRect(Math.round(d.dx + lx * d.f), Math.round(y), Math.max(2, Math.round(lw * d.f)), Math.max(2, Math.round(lh * d.f)));
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Setas, pisca-alerta e luz de freio (visíveis de dia também). */
  private drawSignals(ctx: CanvasRenderingContext2D, night: number) {
    const on = Math.floor(this.clock * 3) % 2 === 0;
    for (const d of this.drawn) {
      const v = d.v;
      const light = (idx: number, col: string) => {
        const L = v.lights[idx];
        if (!L) return;
        const y = d.dy + L[1] * d.f;
        if (y > d.clip) return;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(d.dx + L[0] * d.f), Math.round(y), Math.max(2, Math.round(L[2] * d.f)), Math.max(2, Math.round(L[3] * d.f)));
      };
      ctx.globalAlpha = Math.min(1, d.alpha + 0.3);
      // de dia, quem está longe ganha lanternas marcadas (os pontinhos vermelhos do Enduro)
      if (night < 0.5 && !v.brake && v.kind !== 'contramao' && d.f < 0.45 * K) {
        light(0, '#b8242a');
        light(1, '#b8242a');
      }
      if (v.brake && night < 0.5 && v.kind !== 'moto') {
        light(0, '#ff3b2f');
        light(1, '#ff3b2f');
      }
      if (on && (v.hazard || v.blink !== 0)) {
        if (v.hazard || v.blink < 0) light(0, '#ffb02e');
        if (v.hazard || v.blink > 0) light(1, '#ffb02e');
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawRain(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(201,214,232,0.55)';
    const t = this.clock;
    for (let i = 0; i < 280; i++) {
      const x = (i * 53 + Math.floor(t * 90 * K) * 3) % (W + 20) - 10;
      const y = (i * 29 + Math.floor(t * 300 * K)) % H;
      ctx.fillRect(x, y, 1, 5);
      ctx.fillRect(x - 1, y + 5, 1, 3);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    // o HUD continua desenhado em coordenadas 320×200, ampliado K vezes
    ctx.save();
    ctx.scale(K, K);
    this.drawHudLayer(ctx);
    ctx.restore();
  }

  private drawHudLayer(ctx: CanvasRenderingContext2D) {
    const W = 320;
    const p = this.player;
    const Y = '#ffd23f';
    const T = '#f4efe2';
    const mm = Math.floor(this.time / 60);
    const ss = Math.floor(this.time % 60);
    drawText(ctx, 'TEMPO', 6, 5, Y);
    drawText(ctx, `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 6, 12, T, 2);
    drawText(ctx, 'PACOTES', 160 - textWidth('PACOTES') / 2, 5, Y);
    const pk = String(this.packages).padStart(2, '0');
    drawText(ctx, pk, 160 - textWidth(pk, 2) / 2, 12, T, 2);
    drawText(ctx, `NÍVEL ${this.level}`, 160 - textWidth(`NIVEL ${this.level}`) / 2, 25, '#c9c0d8');
    const pts = String(this.points);
    drawText(ctx, 'PONTOS', W - 6 - textWidth('PONTOS'), 5, Y);
    drawText(ctx, pts, W - 6 - textWidth(pts, 2), 12, T, 2);
    const dist = `${Math.floor(this.meters)} M`;
    drawText(ctx, dist, W - 6 - textWidth(dist), 25, '#c9c0d8');
    // vidas e capacetes
    const heart = this.assets['itens/coracao'];
    for (let i = 0; i < Math.max(START_LIVES, p.lives); i++) {
      ctx.globalAlpha = i < p.lives ? 1 : 0.3;
      ctx.drawImage(heart, 6 + i * 10, 26, 7, 6);
    }
    const hel = this.assets['itens/capacete_voo_0'];
    for (let i = 0; i < MAX_HELMETS; i++) {
      ctx.globalAlpha = i < p.helmets ? 1 : 0.3;
      ctx.drawImage(hel, 6 + Math.max(START_LIVES, p.lives) * 10 + 4 + i * 10, 25, 8, 8);
    }
    ctx.globalAlpha = 1;
    // grau
    drawText(ctx, p.grauOn ? 'GRAU!' : 'GRAU', 6, 179, p.grauOn ? '#5fd17a' : T);
    ctx.fillStyle = '#1b1220';
    ctx.fillRect(6, 186, 78, 9);
    ctx.fillStyle = T;
    ctx.fillRect(6, 186, 78, 1);
    ctx.fillRect(6, 194, 78, 1);
    ctx.fillRect(6, 186, 1, 9);
    ctx.fillRect(83, 186, 1, 9);
    ctx.fillStyle = p.grau > 0.15 ? '#3fa65a' : '#ff8a2a';
    ctx.fillRect(8, 188, Math.round(74 * p.grau), 5);
    if (p.boostT > 0) drawText(ctx, `VELOCIDADE ${Math.ceil(p.boostT)}`, 90, 188, '#9fe0ff');
    // velocímetro
    ctx.fillStyle = '#1b1220';
    ctx.fillRect(256, 168, 58, 27);
    ctx.fillStyle = '#5fd17a';
    ctx.fillRect(256, 168, 58, 1);
    ctx.fillRect(256, 194, 58, 1);
    ctx.fillRect(256, 168, 1, 27);
    ctx.fillRect(313, 168, 1, 27);
    drawText(ctx, 'KM/H', 290, 171, '#5fd17a', 1, null);
    const kmh = String(Math.round(p.speed / KMH)).padStart(3, ' ');
    drawText(ctx, kmh, 262, 178, '#ff3b2f', 3, null);

    // avisos
    const pz = this.playerZ;
    const warnings: string[] = [];
    if (this.vehicles.some((v) => v.kind === 'ambulancia' && v.z < pz - 200 && v.z > pz - 6000)) warnings.push('AMBULÂNCIA ATRÁS!');
    if (this.vehicles.some((v) => v.kind === 'contramao' && v.z > pz && v.z < pz + 14000)) warnings.push('CONTRAMÃO À FRENTE!');
    if (Math.floor(this.clock * 4) % 2 === 0) warnings.forEach((w, i) => drawText(ctx, w, 160 - textWidth(w) / 2, 40 + i * 8, '#ff4d5e'));

    // faixas de mensagem
    if (this.phase === 'countdown') {
      const n = String(Math.ceil(this.countdown));
      drawText(ctx, n, 160 - textWidth(n, 5) / 2, 70, Y, 5);
    }
    if (this.banner) drawText(ctx, this.banner.text, 160 - textWidth(this.banner.text, 2) / 2, 62, this.banner.color, 2);
    this.popups.forEach((pp, i) => {
      const y = 140 - (1 - pp.t) * 18 - i * 9;
      drawText(ctx, pp.text, 160 - textWidth(pp.text) / 2, y, pp.color);
    });
  }

  // ================================================================ hud
  private emit() {
    const hud: HudState = {
      phase: this.phase,
      paused: this.paused,
      points: this.points,
      time: Math.floor(this.time),
      packages: this.packages,
      meters: Math.floor(this.meters),
      level: this.level,
      record: Math.max(this.record, this.phase === 'over' ? this.points : 0),
      newRecord: this.phase === 'over' && this.points > this.record,
      overtakes: this.overtakes,
    };
    const key = `${hud.phase}|${hud.paused}|${hud.phase === 'over' ? hud.points : ''}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.onHud(hud);
  }
}
