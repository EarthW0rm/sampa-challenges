import { planComputerShot } from './ai';
import { riderKey, type Assets, type RiderPose } from './assets';
import { applyCrater, generateCity, type City } from './city';
import { blit, SCALE, upscaleAll } from './hires';
import {
  CRATER_RADIUS,
  DESTROY_CRATER_RADIUS,
  H,
  MOTO_HP,
  RIDER_SIZE,
  SUBSTEPS_PER_SECOND,
  SUN_POS,
  W,
} from './constants';
import { launch, riderBoxes, stepFlight, type Flight, type World } from './physics';
import { sfx } from './sound';
import type { PlayerIndex, Settings, Shot } from './types';

export type Phase = 'aiming' | 'thinking' | 'flying' | 'exploding' | 'roundOver' | 'gameOver';

export interface HudState {
  phase: Phase;
  turn: PlayerIndex;
  scores: [number, number];
  wind: number;
  round: number;
  /** Acertos que cada moto já levou (0–3). */
  damage: [number, number];
  /** Último tiro de cada jogador (para preencher os campos). */
  lastShots: [Shot | null, Shot | null];
  /** Tiro que o computador anunciou (aparece antes de lançar). */
  computerShot: Shot | null;
  message: string | null;
  roundWinner: PlayerIndex | null;
  /** Treino: tiros e acertos. */
  practiceShots: number;
  practiceHits: number;
}

interface Explosion {
  x: number;
  y: number;
  elapsed: number;
  big: boolean;
  then: 'endTurn' | 'roundOver';
}

/** Pedaços de moto, fumaça e faíscas. */
interface Particle {
  kind: 'debris' | 'spark' | 'smoke';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  gravity: number;
}

const SUBSTEP_MS = 1000 / SUBSTEPS_PER_SECOND;
const EXPLOSION_FRAME_MS = 110;
const ROUND_OVER_MS = 2800;
const THINK_MS = 800;
const ANNOUNCE_MS = 900;
const THROW_POSE_MS = 280;

const PART_NAMES = ['o baú', 'o farol e a roda'];
const DEBRIS = [
  ['#d42a2a', '#9e1c1c', '#3d7fb5', '#1b1220', '#b9b6ad'],
  ['#ffd23f', '#d9901a', '#3fa65a', '#1b1220', '#b9b6ad'],
];

export class CapaceteEngine {
  private city!: City;
  private wind = 0;
  private turn: PlayerIndex = 0;
  private startingPlayer: PlayerIndex = 0;
  private scores: [number, number] = [0, 0];
  private phase: Phase = 'aiming';
  private round = 0;
  private alive: [boolean, boolean] = [true, true];
  private damage: [number, number] = [0, 0];
  private knockedOut: [boolean, boolean] = [false, false];
  private flight: Flight | null = null;
  private flightAcc = 0;
  private explosion: Explosion | null = null;
  private particles: Particle[] = [];
  private smokeClock = 0;
  private sunShocked = false;
  private throwPose: { who: PlayerIndex; ms: number } | null = null;
  private roundWinner: PlayerIndex | null = null;
  private roundTimer = 0;
  private danceClock = 0;
  private thinkTimer = 0;
  private computerShot: Shot | null = null;
  private computerShotsThisRound = 0;
  private lastShots: [Shot | null, Shot | null] = [null, null];
  private message: string | null = null;
  private practiceShots = 0;
  private practiceHits = 0;
  private practiceRoundStart = 0;

  constructor(
    private readonly assets: Assets,
    private readonly settings: Settings,
    private readonly onHud: (hud: HudState) => void,
  ) {
    this.newRound();
  }

  // ---------------------------------------------------------------- regras

  isHuman(player: PlayerIndex): boolean {
    if (this.settings.mode === 'pvp') return true;
    return player === 0;
  }

  /** No treino o motoboy da direita nunca ataca. */
  private nextTurn(): PlayerIndex {
    if (this.settings.mode === 'practice') return 0;
    return this.turn === 0 ? 1 : 0;
  }

  private randomWind(): number {
    let wind = Math.floor(Math.random() * 11) - 5;
    if (Math.random() < 1 / 3) wind += (wind >= 0 ? 1 : -1) * Math.floor(Math.random() * 10);
    return wind;
  }

  newRound() {
    sfx.flightStop();
    this.city = generateCity(this.assets);
    this.wind = this.randomWind();
    this.round++;
    this.alive = [true, true];
    this.damage = [0, 0];
    this.knockedOut = [false, false];
    this.flight = null;
    this.explosion = null;
    this.particles = [];
    this.sunShocked = false;
    this.roundWinner = null;
    this.computerShotsThisRound = 0;
    this.message = null;
    this.turn = this.settings.mode === 'practice' ? 0 : this.startingPlayer;
    this.beginTurn();
  }

  /** Reinicia a partida inteira (placar zerado). */
  restart() {
    this.scores = [0, 0];
    this.round = 0;
    this.startingPlayer = 0;
    this.practiceShots = 0;
    this.practiceHits = 0;
    this.practiceRoundStart = 0;
    this.lastShots = [null, null];
    this.newRound();
  }

  private beginTurn() {
    this.computerShot = null;
    if (this.isHuman(this.turn)) {
      this.phase = 'aiming';
    } else {
      this.phase = 'thinking';
      this.thinkTimer = THINK_MS;
    }
    this.emit();
  }

  private world(): World {
    const g = this.city.riders;
    return {
      mask: this.city.mask,
      riders: [riderBoxes(g[0], 0), riderBoxes(g[1], 1)],
      alive: this.alive,
      wind: this.wind,
      gravity: this.settings.gravity,
    };
  }

  /** Chamado pela interface quando um humano lança. */
  submitShot(shot: Shot) {
    if (this.phase !== 'aiming' || !this.isHuman(this.turn)) return;
    this.fire(shot);
  }

  private fire(shot: Shot) {
    this.lastShots[this.turn] = shot;
    if (this.settings.mode === 'practice') this.practiceShots++;
    this.flight = launch(this.turn, this.city.riders[this.turn], shot);
    this.flightAcc = 0;
    this.throwPose = { who: this.turn, ms: THROW_POSE_MS };
    const from = this.city.riders[this.turn];
    sfx.throw(from.x + RIDER_SIZE / 2);
    sfx.flightStart(from.x + RIDER_SIZE / 2);
    this.phase = 'flying';
    this.message = null;
    this.emit();
  }

  private endTurn() {
    this.sunShocked = false;
    this.turn = this.nextTurn();
    this.beginTurn();
  }

  private practiceShotsThisRound(): string {
    const n = this.practiceShots - this.practiceRoundStart;
    return n === 1 ? '1 tiro' : `${n} tiros`;
  }

  /** Capacete pegou num motoboy: na cabeça vence direto; na moto, quebra uma parte. */
  private onRiderHit(index: PlayerIndex, kind: 'pilot' | 'moto', x: number, y: number) {
    const shooter = this.turn;
    const other: PlayerIndex = index === 0 ? 1 : 0;
    const self = index === shooter;
    const names = this.settings.names;
    const practice = this.settings.mode === 'practice';
    let roundOver = false;

    sfx.flightStop();
    if (kind === 'pilot') {
      this.knockedOut[index] = true;
      sfx.pilotHit(x);
      roundOver = true;
      this.spawnSparks(x, y);
      this.message = self ? `${names[index]} acertou a própria cabeça!` : `Capacetada na cabeça de ${names[index]}!`;
    } else {
      this.damage[index]++;
      this.spawnDebris(index, x, y);
      if (this.damage[index] < MOTO_HP) sfx.motoHit(x);
      if (this.damage[index] >= MOTO_HP) {
        roundOver = true;
        const pos = this.city.riders[index];
        applyCrater(this.city, pos.x + RIDER_SIZE / 2, pos.y + RIDER_SIZE - 4, DESTROY_CRATER_RADIUS);
        sfx.bigBoom(x);
        this.message = `A moto de ${names[index]} foi destruída!`;
      } else {
        const part = PART_NAMES[this.damage[index] - 1];
        this.message = self ? `${names[index]} quebrou ${part} da própria moto!` : `${names[shooter]} quebrou ${part} de ${names[index]}!`;
      }
    }

    if (practice && index === 1) this.practiceHits++;

    if (roundOver) {
      // quem levou o golpe perde a rodada, mesmo que tenha sido o próprio tiro
      const winner = other;
      this.roundWinner = practice && index === 0 ? null : winner;
      if (!practice) this.scores[winner]++;
      else if (index === 1) this.message += ` (${this.practiceShotsThisRound()})`;
    }

    this.explosion = { x, y, elapsed: 0, big: roundOver && kind === 'moto', then: roundOver ? 'roundOver' : 'endTurn' };
    this.phase = 'exploding';
    this.emit();
  }

  /** Chamado ao desmontar a tela: silencia o assobio do capacete em voo. */
  dispose() {
    sfx.flightStop();
  }

  // --------------------------------------------------------------- update

  update(ms: number) {
    ms = Math.max(0, Math.min(ms, 100));
    if (this.throwPose) {
      this.throwPose.ms -= ms;
      if (this.throwPose.ms <= 0) this.throwPose = null;
    }
    this.updateParticles(ms / 1000);

    switch (this.phase) {
      case 'thinking': {
        this.thinkTimer -= ms;
        if (this.thinkTimer <= 0) {
          if (!this.computerShot) {
            const me = this.turn;
            const target: PlayerIndex = me === 0 ? 1 : 0;
            this.computerShot = planComputerShot(
              this.settings.difficulty,
              this.world(),
              me,
              this.city.riders[me],
              target,
              this.computerShotsThisRound,
            );
            this.computerShotsThisRound++;
            this.thinkTimer = ANNOUNCE_MS;
            this.emit();
          } else {
            this.fire(this.computerShot);
          }
        }
        break;
      }
      case 'flying': {
        const f = this.flight!;
        this.flightAcc += ms;
        const w = this.world();
        while (this.flightAcc >= SUBSTEP_MS) {
          this.flightAcc -= SUBSTEP_MS;
          const ev = stepFlight(f, w);
          if (f.touchedSun && !this.sunShocked) sfx.sun();
          if (f.touchedSun) this.sunShocked = true;
          if (ev.kind === 'none') continue;
          this.flight = null;
          sfx.flightStop();
          if (ev.kind === 'out') {
            sfx.miss(Math.max(0, Math.min(W, f.x)));
            this.endTurn();
          } else if (ev.kind === 'building') {
            sfx.boom(ev.x);
            applyCrater(this.city, ev.x, ev.y, CRATER_RADIUS);
            this.explosion = { x: ev.x, y: ev.y, elapsed: 0, big: false, then: 'endTurn' };
            this.phase = 'exploding';
          } else {
            this.onRiderHit(ev.index, ev.kind, ev.x, ev.y);
          }
          break;
        }
        if (this.flight) sfx.flightUpdate(f.x, f.y);
        break;
      }
      case 'exploding': {
        const e = this.explosion!;
        e.elapsed += ms;
        const total = EXPLOSION_FRAME_MS * (e.big ? 5 : 3);
        if (e.elapsed >= total) {
          this.explosion = null;
          if (e.then === 'endTurn') {
            this.endTurn();
          } else {
            this.phase = 'roundOver';
            this.roundTimer = ROUND_OVER_MS;
            this.danceClock = 0;
            if (this.settings.mode !== 'practice' && Math.max(...this.scores) >= this.settings.pointsToWin) {
              this.phase = 'gameOver';
              sfx.fanfare();
            } else if (this.roundWinner !== null) sfx.roundWin();
            else sfx.roundLose();
            this.emit();
          }
        }
        break;
      }
      case 'roundOver': {
        this.danceClock += ms;
        this.roundTimer -= ms;
        if (this.roundTimer <= 0) {
          if (this.settings.mode !== 'practice') this.startingPlayer = this.startingPlayer === 0 ? 1 : 0;
          this.practiceRoundStart = this.practiceShots;
          this.newRound();
        }
        break;
      }
      case 'gameOver':
        this.danceClock += ms;
        break;
      case 'aiming':
        break;
    }
  }

  // ------------------------------------------------------------ partículas

  private spawnDebris(index: PlayerIndex, x: number, y: number) {
    const colors = DEBRIS[index];
    const away = index === 0 ? -1 : 1;
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        kind: 'debris',
        x,
        y,
        vx: (Math.random() * 50 + 10) * (Math.random() < 0.75 ? away : -away),
        vy: -Math.random() * 70 - 20,
        life: 0,
        max: 0.9 + Math.random() * 0.6,
        color: colors[i % colors.length],
        gravity: 160,
      });
    }
  }

  private spawnSparks(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * 45,
        vy: Math.sin(a) * 45,
        life: 0,
        max: 0.45,
        color: i % 2 ? '#ffd36b' : '#f4efe2',
        gravity: 0,
      });
    }
  }

  private updateParticles(dt: number) {
    // fumaça saindo das motos com 2+ acertos
    this.smokeClock -= dt;
    if (this.smokeClock <= 0) {
      this.smokeClock = 0.12;
      for (const i of [0, 1] as const) {
        if (this.damage[i] < 2) continue;
        const p = this.city.riders[i];
        const fx = i === 0 ? p.x + 30 : p.x + RIDER_SIZE - 30;
        const fy = this.damage[i] >= MOTO_HP ? p.y + 32 : p.y + 24;
        this.particles.push({
          kind: 'smoke',
          x: fx + (Math.random() - 0.5) * 3,
          y: fy,
          vx: this.wind * 1.2 + (Math.random() - 0.5) * 4,
          vy: -12 - Math.random() * 6,
          life: 0,
          max: 1.1,
          color: Math.random() < 0.5 ? '#6e6a72' : '#4a4552',
          gravity: 0,
        });
      }
    }
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max && p.y < H + 4);
  }

  // --------------------------------------------------------------- render

  /** Desenha em um canvas de W·SCALE × H·SCALE; as coordenadas continuam lógicas (640×400). */
  render(ctx: CanvasRenderingContext2D) {
    const a = upscaleAll(this.assets);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    blit(ctx, a.ceu, 0, 0);
    blit(ctx, this.sunShocked ? a.sol_assustado : a.sol_normal, SUN_POS.x, SUN_POS.y);
    ctx.drawImage(this.city.canvas, 0, 0, W, H);

    for (const i of [0, 1] as const) {
      const p = this.city.riders[i];
      const img = a[this.riderSprite(i)];
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (i === 0) {
        blit(ctx, img, x, y);
      } else {
        ctx.save();
        ctx.translate(x + RIDER_SIZE, y);
        ctx.scale(-1, 1);
        blit(ctx, img, 0, 0);
        ctx.restore();
      }
    }

    for (const p of this.particles) {
      const fade = p.life / p.max;
      const smoke = p.kind === 'smoke';
      ctx.globalAlpha = smoke ? 0.85 * (1 - fade) : 1;
      ctx.fillStyle = p.color;
      const s = smoke && fade > 0.4 ? 2 : 1;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;

    if (this.flight) this.drawProjectile(ctx, this.flight);
    if (this.explosion) this.drawExplosion(ctx, this.explosion);
    if (this.settings.rain) blit(ctx, a.garoa, 0, 0);
    this.drawWind(ctx);
  }

  private riderSprite(i: PlayerIndex): string {
    const dmg = this.damage[i];
    let pose: RiderPose = '';
    if (this.knockedOut[i]) pose = '_ko';
    else if ((this.phase === 'roundOver' || this.phase === 'gameOver') && this.roundWinner === i && dmg < MOTO_HP) {
      // vencedor comemora dando grau
      pose = Math.floor(this.danceClock / 260) % 2 === 0 ? '_grau' : '';
    } else if (this.throwPose?.who === i) pose = '_arremesso';
    return riderKey(i, dmg, pose);
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, f: Flight) {
    // meio pixel lógico = 1 pixel de tela: o voo fica mais suave
    const x = Math.round(f.x * SCALE) / SCALE - 4;
    const y = Math.round(f.y * SCALE) / SCALE - 4;
    if (y < -8) {
      // fora da tela por cima: marcador no topo
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(Math.round(f.x) - 1, 0, 3, 2);
      return;
    }
    let idx = Math.floor(f.step / 6) % 4;
    if (f.owner === 1) idx = (4 - idx) % 4;
    blit(ctx, upscaleAll(this.assets)[`capacete_${f.owner === 0 ? 'p1' : 'p2'}_${idx}`], x, y);
  }

  private drawExplosion(ctx: CanvasRenderingContext2D, e: Explosion) {
    const a = upscaleAll(this.assets);
    const frames = e.big
      ? [a.explosao_0, a.explosao_1, a.explosao_1, a.explosao_2, a.explosao_2]
      : [a.explosao_0, a.explosao_1, a.explosao_2];
    const idx = Math.min(frames.length - 1, Math.floor(e.elapsed / EXPLOSION_FRAME_MS));
    const size = e.big ? 40 : 16;
    ctx.drawImage(frames[idx], Math.round(e.x - size / 2), Math.round(e.y - size / 2), size, size);
  }

  private drawWind(ctx: CanvasRenderingContext2D) {
    if (this.wind === 0) return;
    const y = H - 5;
    const len = Math.min(60, Math.abs(this.wind) * 4);
    const dir = this.wind > 0 ? 1 : -1;
    const x0 = W / 2;
    ctx.fillStyle = '#1b1220';
    ctx.fillRect(Math.min(x0, x0 + dir * len) - 1, y - 1, len + 2, 3);
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(Math.min(x0, x0 + dir * len), y, len, 1);
    const tip = x0 + dir * len;
    ctx.fillRect(tip - dir, y - 1, 1, 3);
    ctx.fillRect(tip - 2 * dir, y - 2, 1, 5);
  }

  // ------------------------------------------------------------------ hud

  private emit() {
    this.onHud({
      phase: this.phase,
      turn: this.turn,
      scores: [...this.scores] as [number, number],
      wind: this.wind,
      round: this.round,
      damage: [...this.damage] as [number, number],
      lastShots: [...this.lastShots] as [Shot | null, Shot | null],
      computerShot: this.computerShot,
      message: this.message,
      roundWinner: this.roundWinner,
      practiceShots: this.practiceShots,
      practiceHits: this.practiceHits,
    });
  }
}
