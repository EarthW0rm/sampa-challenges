import {
  AWARDS,
  BALLS_PER_GAME,
  BONUS_PTS,
  BONUS_SECONDS,
  BALL_R,
  BALL_REST_Y,
  BUMPER_KICK,
  BUMPER_R,
  DRAIN_Y,
  E_FLIPPER,
  E_WALL,
  FLIPPER_LEN,
  FLIPPER_OMEGA_DOWN,
  FLIPPER_OMEGA_UP,
  FLIPPER_PIVOT_L,
  FLIPPER_PIVOT_R,
  FLIPPER_R0,
  FLIPPER_R1,
  FLIPPER_REST,
  FLIPPER_UP,
  GRAVITY,
  H,
  KICKOUT,
  KICKOUT_COOLDOWN,
  KICKOUT_HOLD,
  KICKOUT_MAX_SPEED,
  KICK_EJECT_MIN_DEG,
  KICK_EJECT_RANGE_DEG,
  KICK_EJECT_SPEED,
  LANE_X,
  MAX_DT,
  MAX_MULT,
  MAX_SPEED,
  MAX_SUBSTEPS,
  NUDGE_COOLDOWN,
  NUDGE_DECAY,
  NUDGE_LIMIT,
  NUDGE_PUSH_X,
  NUDGE_PUSH_Y,
  PLUNGER_CHARGE_TIME,
  PLUNGER_MIN,
  PLUNGER_MIN_CHARGE,
  PLUNGER_RANGE,
  PTS,
  REST_SPEED,
  SAVER_AWARD_SECONDS,
  SAVER_SECONDS,
  SEMAFORO_HITS,
  SLING_COOLDOWN,
  SLING_KICK,
  SLING_MIN_HIT,
  STEP,
  TARGET_MIN_HIT,
  W,
  WAVE_SECONDS,
} from './constants';
import { BUMPERS, GATE, POSTS, ROLLOVERS, SLINGS, SPINNERS, TARGETS, WALLS, type Seg } from './geometry';
import { blit, SCALE, upscaleAll } from './hires';
import type { Assets } from './assets';
import type { Input } from './input';
import { drawPixelText, textWidth } from './pixelFont';
import { loadRecord, saveRecord } from './record';
import { sfx } from './sound';
import type { HudState, Phase, ScoreKind } from './types';
import type { PinballE2EState, PinballPrepare, PinballTargets } from './e2eHook';

const INK = '#1b1220';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  px: number;
  py: number;
  /** Parada na rampa, esperando o lançador. */
  rest: boolean;
  /** Segundos que ainda ficará presa no Minhocão (0 = livre). */
  held: number;
  dead: boolean;
}

interface Flipper {
  s: 1 | -1;
  px: number;
  py: number;
  angle: number;
  omega: number;
  up: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  c: string;
}

interface Fx {
  kind: 'brilho' | 'explosao';
  x: number;
  y: number;
  t: number;
}

type Award = (typeof AWARDS)[number];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class PinballEngine {
  private hi: Record<keyof Assets, HTMLCanvasElement>;
  private staticLayer: HTMLCanvasElement | null = null;

  phase: Phase = 'ready';
  private prevPhase: Phase = 'ready';
  score = 0;
  record = loadRecord();
  newRecord = false;
  ballNo = 1;
  mult = 1;
  letters: boolean[] = Array(7).fill(false);
  rolls: boolean[] = [false, false, false];
  bumperHits = [0, 0, 0];
  greens = 0;
  wave = 0;
  saver = 0;
  tilt = false;
  extraPending = false;
  extraGiven = false;
  private nudges = 0;
  private nudgeCd = 0;
  private bonusBase = 0;
  private bonusInfo: { base: number; mult: number; total: number } | null = null;
  private bonusT = 0;
  private message = '';
  private msgT = 0;
  private charge = 0;
  private launched = false;
  private awardIdx = Math.floor(Math.random() * AWARDS.length);
  private acc = 0;
  private time = 0;
  private overT = 0;
  private wallCd = 0;
  private kickCd = 0;
  private kickDir = 1;

  private balls: Ball[] = [];
  private flippers: Flipper[] = [
    { s: 1, px: FLIPPER_PIVOT_L.x, py: FLIPPER_PIVOT_L.y, angle: FLIPPER_REST, omega: 0, up: false },
    { s: -1, px: FLIPPER_PIVOT_R.x, py: FLIPPER_PIVOT_R.y, angle: FLIPPER_REST, omega: 0, up: false },
  ];
  private prevL = false;
  private prevR = false;
  private bumperFlash = [0, 0, 0];
  private slingFlash = [0, 0];
  private slingCd = [0, 0];
  private spin = [{ a: 0, w: 0, acc: 0 }, { a: 0, w: 0, acc: 0 }];
  private targetFlash = Array(7).fill(0);
  private sparks: Spark[] = [];
  private fxs: Fx[] = [];
  private lastHudKey = '';
  /** Pontos do jogo atual por tipo de evento (lidos pelo gancho dos testes para recalcular o placar). */
  private tally: Partial<Record<ScoreKind, { n: number; pts: number }>> = {};
  /** Bônus de cada bola perdida neste jogo (base, multiplicador, total). */
  private bonusLog: { base: number; mult: number; total: number }[] = [];

  constructor(
    assets: Assets,
    private input: Input,
    private onHud: (h: HudState) => void,
  ) {
    this.hi = upscaleAll(assets);
    this.restart();
  }

  get isPaused() {
    return this.phase === 'paused';
  }

  setPaused(p: boolean) {
    if (p && this.phase !== 'paused' && this.phase !== 'over') {
      this.prevPhase = this.phase;
      this.phase = 'paused';
    } else if (!p && this.phase === 'paused') {
      this.phase = this.prevPhase;
    }
    this.emit();
  }

  restart() {
    this.score = 0;
    this.tally = {};
    this.bonusLog = [];
    this.newRecord = false;
    this.record = loadRecord();
    this.ballNo = 1;
    this.letters = Array(7).fill(false);
    this.bumperHits = [0, 0, 0];
    this.greens = 0;
    this.wave = 0;
    this.extraGiven = false;
    this.extraPending = false;
    this.sparks = [];
    this.fxs = [];
    // spinner parado: a roda que ainda girava no fim do jogo anterior não pontua no novo
    this.spin = this.spin.map(() => ({ a: 0, w: 0, acc: 0 }));
    this.serveBall();
    this.msg('SEGURE ESPACO E SOLTE', 3);
    this.emit();
  }

  dispose() {
    if (this.newRecord) saveRecord(this.score);
  }

  // ---------------------------------------------------------------- regras

  private msg(t: string, secs = 1.8) {
    this.message = t;
    this.msgT = secs;
  }

  private addScore(n: number, kind: ScoreKind, count = 1) {
    this.score += n;
    const t = (this.tally[kind] ??= { n: 0, pts: 0 });
    t.n += count;
    t.pts += n;
    if (this.score > this.record) {
      this.record = this.score;
      this.newRecord = true;
      // grava na hora: o título e o card do hub leem o recorde ao renderizar, antes do cleanup deste motor
      saveRecord(this.score);
    }
  }

  private serveBall() {
    this.phase = 'ready';
    this.mult = 1;
    this.rolls = [false, false, false];
    this.bumperHits = [0, 0, 0];
    this.greens = 0;
    this.wave = 0;
    this.saver = 0;
    this.tilt = false;
    this.nudges = 0;
    this.bonusBase = 0;
    this.launched = false;
    this.charge = 0;
    this.balls = [this.newRestBall()];
  }

  private newRestBall(): Ball {
    return { x: LANE_X, y: BALL_REST_Y, vx: 0, vy: 0, px: LANE_X, py: BALL_REST_Y, rest: true, held: 0, dead: false };
  }

  private spark(x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 90;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0.25 + Math.random() * 0.3, c: colors[i % colors.length] });
    }
  }

  private bumpFx(x: number, y: number) {
    this.fxs.push({ kind: 'brilho', x: x - 12, y: y - 12, t: 0 });
  }

  private startWave() {
    this.wave = WAVE_SECONDS;
    this.bumperHits = [0, 0, 0];
    this.greens = 0;
    this.addScore(PTS.ondaVerde, 'ondaVerde');
    this.msg('ONDA VERDE! BUMPERS x2', 2.4);
    sfx.award();
  }

  private bumperScore() {
    const multi = this.liveBalls() > 1;
    return PTS.bumper * (multi ? 2 : 1) * (this.wave > 0 ? 2 : 1);
  }

  private liveBalls() {
    return this.balls.filter((b) => !b.dead).length;
  }

  private applyAward() {
    let kind: Award;
    do {
      this.awardIdx = (this.awardIdx + 1) % AWARDS.length;
      kind = AWARDS[this.awardIdx];
    } while (kind === 'extra' && this.extraGiven);
    sfx.award();
    switch (kind) {
      case 'bonus':
        this.bonusBase += BONUS_PTS.premio;
        this.msg(`BONUS +${BONUS_PTS.premio}`, 2.2);
        break;
      case 'saver':
        this.saver = Math.max(this.saver, SAVER_AWARD_SECONDS);
        this.msg(`SEGURA BOLA ${SAVER_AWARD_SECONDS}S`, 2.2);
        sfx.saver();
        break;
      case 'mult':
        this.mult = Math.min(MAX_MULT, this.mult + 1);
        this.msg(`MULTIPLICADOR X${this.mult}`, 2.2);
        break;
      case 'pontos':
        this.addScore(PTS.premioPontos, 'premioPontos');
        this.msg(`${PTS.premioPontos} PONTOS`, 2.2);
        break;
      case 'onda':
        this.startWave();
        break;
      case 'letra': {
        const i = this.letters.findIndex((v) => !v);
        if (i >= 0) {
          this.letters[i] = true;
          this.msg('LETRA ACESA!', 2);
          if (this.letters.every(Boolean)) this.startMultiball();
        } else this.addScore(PTS.premioLetraCheia, 'premioLetraCheia');
        break;
      }
      case 'extra':
        this.extraPending = true;
        this.extraGiven = true;
        this.msg('BOLA EXTRA!', 2.4);
        sfx.extraBall();
        break;
    }
  }

  private startMultiball() {
    this.addScore(PTS.multiball, 'multiball');
    this.letters = Array(7).fill(false);
    this.msg('MULTIBALL!', 2.6);
    sfx.multiball();
    this.fxs.push({ kind: 'explosao', x: 96, y: 76, t: 0 });
    for (const dx of [-26, 26]) {
      this.balls.push({ x: 111 + dx, y: 100, vx: dx * 1.4, vy: 60, px: 111 + dx, py: 100, rest: false, held: 0, dead: false });
    }
  }

  nudge() {
    if (this.phase !== 'play' || this.tilt || this.nudgeCd > 0) return;
    this.nudgeCd = NUDGE_COOLDOWN;
    this.nudges += 1;
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (const b of this.balls) {
      if (b.rest || b.held > 0) continue;
      b.vx += dir * NUDGE_PUSH_X;
      b.vy -= NUDGE_PUSH_Y;
    }
    sfx.nudge();
    if (this.nudges > NUDGE_LIMIT) {
      this.tilt = true;
      this.msg('TILT!', 3);
      sfx.tilt();
    } else if (this.nudges > NUDGE_LIMIT - 1) {
      // a conta cai continuamente (NUDGE_DECAY), então `>= NUDGE_LIMIT` nunca acontecia e o aviso não aparecia
      this.msg('CUIDADO!', 1.2);
    }
  }

  private ballLost() {
    sfx.drain();
    this.bonusT = BONUS_SECONDS;
    const base = this.tilt ? 0 : this.bonusBase;
    this.bonusInfo = { base, mult: this.mult, total: base * this.mult };
    this.bonusLog.push({ ...this.bonusInfo });
    this.addScore(this.bonusInfo.total, 'bonus');
    this.phase = 'bonus';
  }

  private afterBonus() {
    this.bonusInfo = null;
    if (this.extraPending && !this.tilt) {
      this.extraPending = false;
      this.serveBall();
      this.msg('BOLA EXTRA: LANCE!', 2.4);
      return;
    }
    this.extraPending = false;
    if (this.ballNo >= BALLS_PER_GAME) {
      this.phase = 'over';
      this.overT = 0;
      if (this.newRecord) saveRecord(this.score);
      sfx.fanfare();
      return;
    }
    this.ballNo += 1;
    this.serveBall();
    this.msg('SEGURE ESPACO E SOLTE', 3);
  }

  // ---------------------------------------------------------------- física

  private bounce(b: Ball, nx: number, ny: number, e: number): number {
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return 0;
    const ee = -vn > REST_SPEED ? e : 0;
    b.vx -= (1 + ee) * vn * nx;
    b.vy -= (1 + ee) * vn * ny;
    return -vn;
  }

  /** Bola contra segmento. Devolve a velocidade de impacto (0 = sem contato) e a normal. */
  private segHit(b: Ball, s: Seg, e: number, out: { nx: number; ny: number }): number {
    const abx = s.bx - s.ax;
    const aby = s.by - s.ay;
    const l2 = abx * abx + aby * aby;
    const t = clamp(((b.x - s.ax) * abx + (b.y - s.ay) * aby) / l2, 0, 1);
    const cx = s.ax + abx * t;
    const cy = s.ay + aby * t;
    let dx = b.x - cx;
    let dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= BALL_R * BALL_R) return 0;
    let d = Math.sqrt(d2);
    if (d < 1e-4) {
      const len = Math.sqrt(l2);
      dx = -aby / len;
      dy = abx / len;
      if ((b.px - s.ax) * dx + (b.py - s.ay) * dy < 0) {
        dx = -dx;
        dy = -dy;
      }
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    b.x = cx + nx * BALL_R;
    b.y = cy + ny * BALL_R;
    out.nx = nx;
    out.ny = ny;
    return this.bounce(b, nx, ny, e);
  }

  private circleHit(b: Ball, cx: number, cy: number, r: number, e: number, out: { nx: number; ny: number }): number {
    const dx = b.x - cx;
    const dy = b.y - cy;
    const min = r + BALL_R;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return 0;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d;
    const ny = dy / d;
    b.x = cx + nx * min;
    b.y = cy + ny * min;
    out.nx = nx;
    out.ny = ny;
    return this.bounce(b, nx, ny, e);
  }

  private flipperHit(b: Ball, f: Flipper) {
    const tx = f.px + f.s * FLIPPER_LEN * Math.cos(f.angle);
    const ty = f.py + FLIPPER_LEN * Math.sin(f.angle);
    const abx = tx - f.px;
    const aby = ty - f.py;
    const t = clamp(((b.x - f.px) * abx + (b.y - f.py) * aby) / (FLIPPER_LEN * FLIPPER_LEN), 0, 1);
    const cx = f.px + abx * t;
    const cy = f.py + aby * t;
    const r = FLIPPER_R0 + (FLIPPER_R1 - FLIPPER_R0) * t;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const min = r + BALL_R;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d;
    const ny = dy / d;
    b.x = cx + nx * min;
    b.y = cy + ny * min;
    // velocidade da superfície no ponto de contato
    const rx = cx - f.px;
    const ry = cy - f.py;
    const vsx = f.omega * (-f.s * ry);
    const vsy = f.omega * (f.s * rx);
    const vn = (b.vx - vsx) * nx + (b.vy - vsy) * ny;
    if (vn >= 0) return;
    const e = -vn > REST_SPEED ? E_FLIPPER : 0;
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
    if (-vn > 120) sfx.wall(b.x, -vn * 0.6);
  }

  private stepFlippers() {
    const active = !this.tilt && (this.phase === 'play' || this.phase === 'ready');
    const wants = [active && this.input.left, active && this.input.right];
    this.flippers.forEach((f, i) => {
      f.up = wants[i];
      const target = f.up ? FLIPPER_UP : FLIPPER_REST;
      const speed = f.up ? FLIPPER_OMEGA_UP : FLIPPER_OMEGA_DOWN;
      const dir = Math.sign(target - f.angle);
      const next = f.angle + dir * speed * STEP;
      const clamped = dir > 0 ? Math.min(next, target) : dir < 0 ? Math.max(next, target) : f.angle;
      f.omega = (clamped - f.angle) / STEP;
      f.angle = clamped;
    });
  }

  private stepBall(b: Ball) {
    if (b.dead) return;
    const out = { nx: 0, ny: 0 };
    if (b.held > 0 || b.rest) return;
    b.px = b.x;
    b.py = b.y;
    b.vy += GRAVITY * STEP;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) {
      b.vx *= MAX_SPEED / sp;
      b.vy *= MAX_SPEED / sp;
    }
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;

    // alvos MOTOBOY antes das paredes: a placa fica sobre a guia, e a parede, tratada antes, já rebatia a
    // bola e o alvo nunca via o impacto (as letras só acendiam pelo prêmio do Minhocão)
    TARGETS.forEach((t, i) => {
      if (t.nx === 1 ? b.x < t.seg.ax : b.x > t.seg.ax) return;
      const v = this.segHit(b, t.seg, E_WALL, out);
      if (v > TARGET_MIN_HIT) this.hitTarget(i, b);
    });

    let hitSpeed = 0;
    for (const s of WALLS) hitSpeed = Math.max(hitSpeed, this.segHit(b, s, E_WALL, out));
    if (hitSpeed > 80 && this.wallCd <= 0) {
      sfx.wall(b.x, hitSpeed);
      this.wallCd = 0.07;
    }
    for (const p of POSTS) this.circleHit(b, p.x, p.y, p.r, 0.5, out);
    if (b.x < GATE.ax) this.segHit(b, GATE, E_WALL, out);

    SLINGS.forEach((sl, i) => {
      const face: Seg = { ax: sl.a[0], ay: sl.a[1], bx: sl.c[0], by: sl.c[1] };
      const side1: Seg = { ax: sl.a[0], ay: sl.a[1], bx: sl.b[0], by: sl.b[1] };
      const side2: Seg = { ax: sl.b[0], ay: sl.b[1], bx: sl.c[0], by: sl.c[1] };
      this.segHit(b, side1, E_WALL, out);
      this.segHit(b, side2, E_WALL, out);
      const v = this.segHit(b, face, 0.3, out);
      if (v > SLING_MIN_HIT && this.slingCd[i] <= 0) {
        // chute com um pouco de acaso (ângulo e força): evita a bola ficar "rebatendo" para sempre entre os dois estilingues
        const ang = (Math.random() - 0.5) * 0.7;
        const kx = out.nx * Math.cos(ang) - out.ny * Math.sin(ang);
        const ky = out.nx * Math.sin(ang) + out.ny * Math.cos(ang);
        const kick = SLING_KICK * (0.85 + Math.random() * 0.4);
        const vn = b.vx * kx + b.vy * ky;
        if (vn < kick) {
          b.vx += kx * (kick - vn);
          b.vy += ky * (kick - vn);
        }
        this.slingCd[i] = SLING_COOLDOWN;
        this.slingFlash[i] = 0.1;
        this.addScore(PTS.estilingue, 'estilingue');
        this.bonusBase += BONUS_PTS.estilingue;
        sfx.sling(b.x);
      }
    });

    BUMPERS.forEach((bp, i) => {
      const v = this.circleHit(b, bp.x, bp.y, BUMPER_R, 0.6, out);
      if (v > 0) {
        const vn = b.vx * out.nx + b.vy * out.ny;
        if (vn < BUMPER_KICK) {
          b.vx += out.nx * (BUMPER_KICK - vn);
          b.vy += out.ny * (BUMPER_KICK - vn);
        }
        this.hitBumper(i, b);
      }
    });

    for (const f of this.flippers) this.flipperHit(b, f);

    // sensores
    ROLLOVERS.forEach((r, i) => {
      if (!this.rolls[i] && Math.abs(b.x - r.x) < 9 && Math.abs(b.y - r.y) < 6) {
        this.rolls[i] = true;
        this.addScore(PTS.raia, 'raia');
        this.bonusBase += BONUS_PTS.raia;
        sfx.rollover(i);
        if (this.rolls.every(Boolean)) {
          this.rolls = [false, false, false];
          this.mult = Math.min(MAX_MULT, this.mult + 1);
          this.addScore(PTS.raias, 'raias');
          this.msg(`MULTIPLICADOR X${this.mult}`, 2);
          sfx.award();
        }
      }
    });
    SPINNERS.forEach((sp2, i) => {
      if (Math.abs(b.x - sp2.x) < sp2.w / 2 + 2 && Math.abs(b.y - sp2.y) < 5) {
        const s = this.spin[i];
        s.w = Math.min(60, s.w + Math.abs(b.vy) * 0.012);
        b.vy *= 0.9985;
      }
    });
    if (this.kickCd <= 0 && Math.hypot(b.x - KICKOUT.x, b.y - KICKOUT.y) < KICKOUT.r - 1 && Math.hypot(b.vx, b.vy) < KICKOUT_MAX_SPEED) {
      this.kickCd = KICKOUT_COOLDOWN;
      b.held = KICKOUT_HOLD;
      b.x = KICKOUT.x;
      b.y = KICKOUT.y;
      b.vx = b.vy = 0;
      this.addScore(PTS.minhocao, 'minhocao');
      this.bonusBase += BONUS_PTS.minhocao;
      sfx.kickCapture(b.x);
    }

    // volta a descansar na rampa
    if (b.x > 214 && b.y >= BALL_REST_Y - 0.6 && Math.abs(b.vy) < 25) {
      b.rest = true;
      b.x = LANE_X;
      b.y = BALL_REST_Y;
      b.vx = b.vy = 0;
    }
    if (b.y > DRAIN_Y) b.dead = true;
  }

  private hitBumper(i: number, b: Ball) {
    const bp = BUMPERS[i];
    this.bumperFlash[i] = 0.09;
    this.bumperHits[i] += 1;
    const stage = Math.min(2, Math.floor(this.bumperHits[i] / SEMAFORO_HITS));
    this.addScore(this.bumperScore(), 'bumper');
    this.bonusBase += BONUS_PTS.bumper;
    sfx.bumper(b.x, stage);
    this.bumpFx(bp.x, bp.y);
    this.spark(bp.x, bp.y, 4, ['#ffd36b', '#ffffff']);
    if (this.bumperHits[i] === 2 * SEMAFORO_HITS && this.wave <= 0) {
      this.addScore(PTS.semaforoVerde, 'semaforoVerde');
      this.msg(`SEMAFORO VERDE +${PTS.semaforoVerde}`, 1.4);
    }
    this.greens = this.bumperHits.filter((h) => h >= 2 * SEMAFORO_HITS).length;
    if (this.greens === 3 && this.wave <= 0) this.startWave();
  }

  private hitTarget(i: number, b: Ball) {
    const lit = this.letters[i];
    this.targetFlash[i] = 0.2;
    sfx.target(b.x, !lit);
    this.bonusBase += BONUS_PTS.alvo;
    this.spark(b.x, b.y, 4, ['#ffd36b', '#ff4d5e']);
    if (lit) {
      this.addScore(PTS.letraAcesa, 'letraAcesa');
      return;
    }
    this.letters[i] = true;
    this.addScore(PTS.letraNova, 'letraNova');
    if (this.letters.every(Boolean)) this.startMultiball();
  }

  private stepWorld(dt: number) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < MAX_SUBSTEPS) {
      this.acc -= STEP;
      n++;
      this.stepFlippers();
      for (const b of this.balls) this.stepBall(b);
    }
    if (this.acc > STEP * MAX_SUBSTEPS) this.acc = 0;
  }

  update(rawDt: number) {
    const dt = Math.max(0, Math.min(rawDt, MAX_DT));
    if (this.phase === 'paused') return;
    this.time += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.wallCd > 0) this.wallCd -= dt;
    if (this.kickCd > 0) this.kickCd -= dt;
    this.nudgeCd = Math.max(0, this.nudgeCd - dt);
    this.nudges = Math.max(0, this.nudges - dt * NUDGE_DECAY);
    this.slingCd = this.slingCd.map((v) => Math.max(0, v - dt));
    this.slingFlash = this.slingFlash.map((v) => Math.max(0, v - dt));
    this.bumperFlash = this.bumperFlash.map((v) => Math.max(0, v - dt));
    this.targetFlash = this.targetFlash.map((v) => Math.max(0, v - dt));
    for (const s of this.spin) {
      const before = Math.floor(s.acc);
      s.a += s.w * dt;
      s.acc += s.w * dt / (Math.PI * 2) * 2;
      s.w = Math.max(0, s.w - dt * 6);
      const ticks = Math.floor(s.acc) - before;
      // depois do fim de jogo a roda ainda gira, mas não pontua (o placar final e o recorde já foram fechados)
      if (ticks > 0 && this.phase !== 'over') {
        this.addScore(PTS.spinner * ticks, 'spinner', ticks);
        sfx.spinner(LANE_X / 2);
      }
    }
    for (const sp of this.sparks) {
      sp.t -= dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 300 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.t > 0);
    for (const f of this.fxs) f.t += dt;
    this.fxs = this.fxs.filter((f) => f.t < 0.45);

    // flippers: trocar as raias do topo e estalar
    const l = this.input.left && !this.tilt;
    const r = this.input.right && !this.tilt;
    if ((l && !this.prevL) || (r && !this.prevR)) {
      if (this.phase === 'play' || this.phase === 'ready') {
        sfx.flipper(l && !this.prevL ? 60 : 180);
        const rr = this.rolls;
        if (l && !this.prevL) this.rolls = [rr[1], rr[2], rr[0]];
        else this.rolls = [rr[2], rr[0], rr[1]];
      }
    }
    this.prevL = l;
    this.prevR = r;

    if (this.phase === 'bonus') {
      this.bonusT -= dt;
      if (this.bonusT <= 0) this.afterBonus();
    } else if (this.phase === 'over') {
      this.overT += dt;
    } else {
      // lançador
      const rest = this.balls.find((b) => b.rest && !b.dead);
      if (rest && this.input.plunger) {
        this.charge = Math.min(1, this.charge + dt / PLUNGER_CHARGE_TIME);
        rest.y = BALL_REST_Y + this.charge * 9;
      } else if (this.charge > 0) {
        if (rest && this.charge > PLUNGER_MIN_CHARGE) {
          const p = this.charge;
          rest.rest = false;
          rest.y = BALL_REST_Y;
          rest.px = rest.x;
          rest.py = rest.y;
          rest.vx = 0;
          rest.vy = -(PLUNGER_MIN + PLUNGER_RANGE * p);
          sfx.launch(p);
          if (!this.launched) {
            this.launched = true;
            this.saver = SAVER_SECONDS;
            this.phase = 'play';
          }
        } else if (rest) rest.y = BALL_REST_Y;
        this.charge = 0;
      }

      this.stepWorld(dt);

      // Minhocão: solta a bola presa
      for (const b of this.balls) {
        if (b.held > 0) {
          b.held -= dt;
          if (b.held <= 0) {
            b.held = 0;
            this.applyAward();
            this.kickDir = -this.kickDir;
            const a = (this.kickDir * (KICK_EJECT_MIN_DEG + Math.random() * KICK_EJECT_RANGE_DEG) * Math.PI) / 180;
            b.vx = Math.sin(a) * KICK_EJECT_SPEED;
            b.vy = -Math.cos(a) * KICK_EJECT_SPEED;
            sfx.kickEject(b.x);
          }
        }
      }
      if (this.wave > 0) {
        this.wave -= dt;
        if (this.wave <= 0) this.wave = 0;
      }
      if (this.saver > 0 && !this.balls.some((b) => b.rest)) this.saver = Math.max(0, this.saver - dt);

      // bolas perdidas
      if (this.balls.some((b) => b.dead)) {
        this.balls = this.balls.filter((b) => !b.dead);
        if (this.balls.length === 0) {
          if (this.saver > 0 && !this.tilt) {
            this.balls = [this.newRestBall()];
            this.msg('SEGURA BOLA!', 2);
            sfx.saver();
          } else this.ballLost();
        } else if (this.balls.length === 1 && this.msgT <= 0) this.msg('FIM DO MULTIBALL', 1.2);
      }
    }
    this.emit();
  }

  // ---------------------------------------------------------------- HUD

  private emit() {
    const hud: HudState = {
      phase: this.phase,
      score: this.score,
      record: this.record,
      newRecord: this.newRecord,
      ball: this.ballNo,
      ballsTotal: BALLS_PER_GAME,
      mult: this.mult,
      letters: [...this.letters],
      rolls: [...this.rolls],
      greens: this.greens,
      wave: this.wave > 0,
      saver: this.saver > 0,
      multiball: this.liveBalls() > 1,
      tilt: this.tilt,
      extra: this.extraPending,
      message: this.msgT > 0 ? this.message : '',
      bonus: this.bonusInfo,
      charge: Math.round(this.charge * 20) / 20,
    };
    const key = JSON.stringify(hud);
    if (key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.onHud(hud);
  }

  // ---------------------------------------------------------------- testes de ponta a ponta

  /** Estado para o gancho dos testes (`game/e2eHook.ts`): cópia, só leitura. */
  e2eState(): PinballE2EState {
    const next = (() => {
      let i = this.awardIdx;
      for (let k = 0; k < AWARDS.length; k++) {
        i = (i + 1) % AWARDS.length;
        if (!(AWARDS[i] === 'extra' && this.extraGiven)) return AWARDS[i];
      }
      return AWARDS[i];
    })();
    return {
      phase: this.phase,
      prevPhase: this.prevPhase,
      score: this.score,
      record: this.record,
      newRecord: this.newRecord,
      ball: this.ballNo,
      ballsTotal: BALLS_PER_GAME,
      mult: this.mult,
      letters: [...this.letters],
      rolls: [...this.rolls],
      bumperHits: [...this.bumperHits],
      greens: this.greens,
      wave: this.wave,
      saver: this.saver,
      tilt: this.tilt,
      nudges: this.nudges,
      extraPending: this.extraPending,
      extraGiven: this.extraGiven,
      kickCd: this.kickCd,
      kickDir: this.kickDir,
      nextAward: next,
      bonusBase: this.bonusBase,
      bonus: this.bonusInfo ? { ...this.bonusInfo } : null,
      bonusLog: this.bonusLog.map((b) => ({ ...b })),
      charge: this.charge,
      launched: this.launched,
      message: this.msgT > 0 ? this.message : '',
      balls: this.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, rest: b.rest, held: b.held })),
      flippers: this.flippers.map((f) => ({ angle: f.angle, up: f.up })),
      spin: this.spin.map((s) => ({ w: s.w, turns: s.acc })),
      tally: Object.fromEntries(Object.entries(this.tally).map(([k, v]) => [k, { ...v }])),
      time: this.time,
    };
  }

  /** Alvos em coordenadas lógicas do canvas (240×400) e seletores dos botões. */
  e2eTargets(): PinballTargets {
    return {
      flipperLeft: { x: 0, y: 0, w: W / 2, h: H },
      flipperRight: { x: W / 2, y: 0, w: W / 2, h: H },
      launch: '.pinball-paulista .actions .launch',
      nudge: '.pinball-paulista .actions button:not(.launch)',
      flippers: this.flippers.map((f) => ({ x: f.px, y: f.py })),
      bumpers: BUMPERS.map((b) => ({ x: b.x, y: b.y, r: BUMPER_R })),
      rollovers: ROLLOVERS.map((r) => ({ x: r.x, y: r.y })),
      targets: TARGETS.map((t) => ({ letter: t.letter, x: t.seg.ax, y1: t.seg.ay, y2: t.seg.by, nx: t.nx })),
      spinners: SPINNERS.map((s) => ({ x: s.x, y: s.y, w: s.w })),
      slings: SLINGS.map((s) => ({ a: { x: s.a[0], y: s.a[1] }, c: { x: s.c[0], y: s.c[1] } })),
      kickout: { ...KICKOUT },
      gate: { x: GATE.ax, y1: GATE.ay, y2: GATE.by },
    };
  }

  /** Pré-condições raras dos testes (cada uso é comentado no teste). */
  readonly e2ePrepare: PinballPrepare = {
    ball: (x, y, vx, vy, i = 0) => {
      const b = this.balls[i] ?? this.newRestBall();
      Object.assign(b, { x, y, px: x, py: y, vx, vy, rest: false, held: 0, dead: false });
      if (!this.balls.includes(b)) this.balls.push(b);
      this.emit();
    },
    lights: (o) => {
      if (o.letters) this.letters = [...o.letters];
      if (o.rolls) this.rolls = [...o.rolls];
      if (o.bumperHits) {
        this.bumperHits = [...o.bumperHits];
        this.greens = this.bumperHits.filter((h) => h >= 2 * SEMAFORO_HITS).length;
      }
      if (o.mult !== undefined) this.mult = o.mult;
      if (o.nextAward !== undefined) {
        // posiciona o ciclo para o próximo prêmio ser `nextAward`
        const idx = AWARDS.indexOf(o.nextAward);
        this.awardIdx = (idx - 1 + AWARDS.length) % AWARDS.length;
      }
      if (o.kickCd !== undefined) this.kickCd = o.kickCd;
      if (o.saver !== undefined) this.saver = o.saver;
      this.emit();
    },
  };

  // ---------------------------------------------------------------- desenho

  private buildStatic() {
    const c = document.createElement('canvas');
    c.width = W * SCALE;
    c.height = H * SCALE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    blit(ctx, this.hi.fundo, 0, 0);
    const line = (s: Seg, color: string, ox: number, oy: number) => {
      ctx.fillStyle = color;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(s.bx - s.ax), Math.abs(s.by - s.ay)) * SCALE));
      for (let i = 0; i <= n; i++) {
        const x = s.ax + ((s.bx - s.ax) * i) / n;
        const y = s.ay + ((s.by - s.ay) * i) / n;
        ctx.fillRect(Math.round((x - 1 + ox) * SCALE) / SCALE, Math.round((y - 1 + oy) * SCALE) / SCALE, 2, 2);
      }
    };
    for (const s of WALLS) line(s, INK, 1, 1);
    for (const s of WALLS) line(s, '#c9c0d8', 0, 0);
    for (const s of WALLS) line({ ax: s.ax, ay: s.ay, bx: s.bx, by: s.by }, '#f4efe2', -0.5, -0.5);
    line(GATE, '#ffd36b', 0, 0);
    for (const p of POSTS) this.disc(ctx, p.x, p.y, p.r + 0.6, INK);
    for (const p of POSTS) this.disc(ctx, p.x, p.y, p.r - 0.2, '#f5b860');
    return c;
  }

  private disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
    ctx.fillStyle = color;
    for (let y = -Math.ceil(r); y < Math.ceil(r); y += 0.5) {
      for (let x = -Math.ceil(r); x < Math.ceil(r); x += 0.5) {
        if ((x + 0.25) ** 2 + (y + 0.25) ** 2 <= r * r) ctx.fillRect(cx + x, cy + y, 0.5, 0.5);
      }
    }
  }

  private raster(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => string | null) {
    let last = '';
    const step = 1 / SCALE;
    for (let y = Math.floor(y0); y < y1; y += step) {
      for (let x = Math.floor(x0); x < x1; x += step) {
        const c = fn(x + step / 2, y + step / 2);
        if (!c) continue;
        if (c !== last) {
          ctx.fillStyle = c;
          last = c;
        }
        ctx.fillRect(x, y, step, step);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (!this.staticLayer) this.staticLayer = this.buildStatic();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.staticLayer, 0, 0);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    // raias do topo
    ROLLOVERS.forEach((r, i) => {
      const on = this.rolls[i];
      this.raster(ctx, r.x - 5, r.y - 5, r.x + 6, r.y + 6, (x, y) => {
        const d = Math.abs(x - r.x - 0.5) + Math.abs(y - r.y - 0.5);
        if (d <= 4) return d > 3 ? INK : on ? (d < 1.5 ? '#d4ffe0' : '#5fd17a') : '#3c3450';
        return null;
      });
    });

    // corredores: rodas dos spinners
    SPINNERS.forEach((sp, i) => {
      const s = this.spin[i];
      const half = Math.max(1, Math.abs(Math.cos(s.a)) * (sp.w / 2));
      ctx.fillStyle = INK;
      ctx.fillRect(Math.round(sp.x - half) - 1, sp.y - 2, Math.round(half * 2) + 2, 4);
      ctx.fillStyle = Math.sin(s.a) > 0 ? '#ffd36b' : '#f5b860';
      ctx.fillRect(Math.round(sp.x - half), sp.y - 1, Math.round(half * 2), 2);
    });

    // alvos MOTOBOY
    TARGETS.forEach((t, i) => {
      const lit = this.letters[i];
      const flash = this.targetFlash[i] > 0;
      ctx.fillStyle = INK;
      ctx.fillRect(t.px - 1, t.py - 1, 7, 14);
      ctx.fillStyle = flash ? '#ffffff' : lit ? '#ffd36b' : '#3a3150';
      ctx.fillRect(t.px, t.py, 5, 12);
      drawPixelText(ctx, t.letter, t.px + 1, t.py + 3, lit || flash ? INK : '#8d83a6', 1, null);
    });

    // Minhocão
    const flick = Math.floor(this.time * 6) % 2 === 0;
    this.disc(ctx, KICKOUT.x, KICKOUT.y, KICKOUT.r + 1.5, flick ? '#ffd36b' : '#8d83a6');
    this.disc(ctx, KICKOUT.x, KICKOUT.y, KICKOUT.r, INK);

    // estilingues
    SLINGS.forEach((sl, i) => {
      const flash = this.slingFlash[i] > 0;
      const [ax, ay] = sl.a;
      const [bx, by] = sl.b;
      const [cx, cy] = sl.c;
      const minx = Math.min(ax, bx, cx) - 1;
      const maxx = Math.max(ax, bx, cx) + 1;
      this.raster(ctx, minx, ay - 1, maxx, by + 12, (x, y) => {
        const sgn = (x1: number, y1: number, x2: number, y2: number) => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2);
        const d1 = sgn(ax, ay, bx, by);
        const d2 = sgn(bx, by, cx, cy);
        const d3 = sgn(cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (neg && pos) return null;
        // distância à face que chuta (a-c)
        const dist = Math.abs(d3) / Math.hypot(cx - ax, cy - ay);
        if (dist < 1.2) return flash ? '#ffffff' : '#ffd36b';
        return flash ? '#ffd0d6' : '#ff4d5e';
      });
    });

    // bumpers-semáforo
    BUMPERS.forEach((bp, i) => {
      const stage = Math.min(2, Math.floor(this.bumperHits[i] / 3));
      const frame = this.bumperFlash[i] > 0 ? 3 : this.wave > 0 ? 2 : stage;
      blit(ctx, this.hi[`bumper_${frame}` as 'bumper_0'], bp.x - 12, bp.y - 12);
    });

    // mola do lançador
    const springTop = BALL_REST_Y + BALL_R + this.charge * 9;
    ctx.fillStyle = '#8d83a6';
    for (let y = Math.round(springTop) + 1; y < 400; y += 2) ctx.fillRect(LANE_X - 3 + (y % 4 === 0 ? 0 : 2), y, 4, 1);
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(LANE_X - 4, Math.round(springTop - 1), 8, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(LANE_X - 4, Math.round(springTop + 1), 8, 1);

    // flippers listrados
    for (const f of this.flippers) {
      const tx = f.px + f.s * FLIPPER_LEN * Math.cos(f.angle);
      const ty = f.py + FLIPPER_LEN * Math.sin(f.angle);
      const abx = tx - f.px;
      const aby = ty - f.py;
      this.raster(ctx, Math.min(f.px, tx) - 8, Math.min(f.py, ty) - 8, Math.max(f.px, tx) + 8, Math.max(f.py, ty) + 8, (x, y) => {
        const t = clamp(((x - f.px) * abx + (y - f.py) * aby) / (FLIPPER_LEN * FLIPPER_LEN), 0, 1);
        const cx = f.px + abx * t;
        const cy = f.py + aby * t;
        const r = FLIPPER_R0 + (FLIPPER_R1 - FLIPPER_R0) * t;
        const d = Math.hypot(x - cx, y - cy);
        if (d > r + 0.8) return null;
        if (d > r - 0.5) return INK;
        if (Math.hypot(x - f.px, y - f.py) < 2.2) return '#ffd36b';
        return Math.floor((t * FLIPPER_LEN) / 6) % 2 === 0 ? '#ff4d5e' : '#f4efe2';
      });
    }

    // bolas
    for (const b of this.balls) {
      if (b.held > 0) continue;
      const bx = Math.round(b.x * SCALE) / SCALE;
      const by = Math.round(b.y * SCALE) / SCALE;
      this.raster(ctx, bx - BALL_R - 1, by - BALL_R - 1, bx + BALL_R + 1, by + BALL_R + 1, (x, y) => {
        const dx = x - bx;
        const dy = y - by;
        const d = Math.hypot(dx, dy);
        if (d > BALL_R + 0.6) return null;
        if (d > BALL_R - 0.5) return INK;
        if (Math.hypot(dx + 1.7, dy + 1.7) < 1.1) return '#ffffff';
        const lit = (-dx * 0.6 - dy * 0.8) / BALL_R;
        return lit > 0.3 ? '#eceaf5' : lit > -0.25 ? '#c9c0d8' : '#8d83a6';
      });
    }

    // efeitos
    for (const f of this.fxs) {
      const k = Math.min(2, Math.floor(f.t / 0.15));
      const img = f.kind === 'brilho' ? this.hi[`brilho_${k}` as 'brilho_0'] : this.hi[`explosao_${k}` as 'explosao_0'];
      blit(ctx, img, f.x, f.y);
    }
    for (const s of this.sparks) {
      ctx.fillStyle = s.c;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }

    // mensagem
    if (this.msgT > 0 && this.message) {
      const w = textWidth(this.message, 2);
      const x = Math.round(111 - w / 2);
      ctx.fillStyle = 'rgba(27,18,32,0.82)';
      ctx.fillRect(x - 5, 120, w + 10, 16);
      drawPixelText(ctx, this.message, x, 125, '#ffd36b', 2);
    }
    if (this.tilt) {
      drawPixelText(ctx, 'TILT', 111 - textWidth('TILT', 3) / 2, 270, '#ff4d5e', 3);
    }
  }
}
