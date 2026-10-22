import { chooseShot, type Shot } from './ai';
import type { AiRequest, AiResponse } from './ai.worker';
import type { Assets } from './assets';
import {
  AI_AIM_S,
  AI_THINK_S,
  AIM_FINE_DEG,
  AIM_STEP_DEG,
  BALL_R,
  BOX_L,
  BOX_R,
  CUE_LENGTH,
  CUE_PULL,
  CY,
  DEFAULT_POWER,
  FELT_B,
  FELT_L,
  FELT_T,
  HEAD_X,
  MAX_SPEED,
  MID_X,
  PHYS_DT,
  POWER_STEP,
  SINK_S,
  STROKE_S,
  TOAST_S,
} from './constants';
import { blit, SCALE, upscaleAll } from './hires';
import { anyMoving, type Ball, canPlaceCue, castRay, cloneBalls, newEvents, type PhysicsListener, type ShotEvents, step } from './physics';
import { drawPixelText, textWidth } from './pixelFont';
import {
  footSpot,
  groupOf,
  legalTargets,
  type MatchState,
  newMatch,
  onCastigo,
  rack,
  remaining,
  resolveShot,
  RULES,
} from './rules';
import { sfx } from './sound';
import type { HudState, Settings } from './types';

/** Tira acentos (a fonte 3×5 do canvas não tem). */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

type Phase = 'aim' | 'stroke' | 'rolling' | 'over';

interface CpuTurn {
  stage: 'think' | 'aim';
  t: number;
  shot: Shot | null;
  from: number;
}

interface Sink {
  n: number;
  x: number;
  y: number;
  px: number;
  py: number;
  t: number;
}

/**
 * Motor da partida: mesa (física de `physics.ts`), regras (`rules.ts`), entrada, vez do computador
 * (Web Worker com `ai.ts`), animações e desenho do canvas. O React só recebe o `HudState`.
 */
export class SinucaEngine {
  private hi: Record<string, HTMLCanvasElement>;
  private balls: Ball[] = [];
  private match!: MatchState;
  private phase: Phase = 'aim';
  private aim = 0;
  private power = DEFAULT_POWER;
  private strokeT = 0;
  private acc = 0;
  private events: ShotEvents = newEvents();
  private before: Ball[] = [];
  private toasts: { text: string; t: number }[] = [];
  private sinks: Sink[] = [];
  private draggingCue = false;
  private lastValidCue = { x: 0, y: 0 };
  private pressed = false;
  private cpu: CpuTurn | null = null;
  private worker: Worker | null = null;
  private aiId = 0;
  private wins: [number, number] = [0, 0];
  private breaker: 0 | 1;
  private time = 0;
  private hudKey = '';
  private listener: PhysicsListener = {
    ballHit: (v) => sfx.clack(v / MAX_SPEED),
    cushionHit: (v) => sfx.cushion(v / MAX_SPEED),
    pocket: (b, p) => {
      sfx.pocket();
      this.sinks.push({ n: b.n, x: b.x, y: b.y, px: p.x, py: p.y, t: 0 });
    },
  };

  constructor(
    assets: Assets,
    private settings: Settings,
    private onHud: (h: HudState) => void,
  ) {
    this.hi = upscaleAll(assets);
    this.breaker = settings.breaker === 'p2' ? 1 : settings.breaker === 'random' ? (Math.random() < 0.5 ? 0 : 1) : 0;
    this.worker = this.createWorker();
    this.newRack();
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.aiId++;
  }

  private isCpu(p: 0 | 1) {
    return this.settings.mode === 'pvc' && p === 1;
  }

  private get cue(): Ball {
    return this.balls[0];
  }

  private name(p: 0 | 1) {
    return this.settings.mode === 'pvc' && p === 1 ? 'Computador' : this.settings.names[p];
  }

  // ------------------------------------------------------------------ partida

  private newRack() {
    this.cancelCpu();
    this.balls = [{ n: 0, x: HEAD_X - 8, y: CY, vx: 0, vy: 0, on: true }, ...rack(this.settings.rules).map((r) => ({ ...r, vx: 0, vy: 0, on: true }))];
    this.match = newMatch(this.settings.rules, this.breaker);
    this.phase = 'aim';
    this.toasts = [];
    this.sinks = [];
    this.draggingCue = false;
    this.lastValidCue = { x: this.cue.x, y: this.cue.y };
    this.aim = 0;
    this.toast(`${this.name(this.breaker)} dá a saída`);
    this.emitHud();
  }

  /** Nova partida: a saída passa para o outro jogador. */
  restart() {
    this.breaker = (this.breaker ^ 1) as 0 | 1;
    this.newRack();
  }

  private toast(text: string) {
    this.toasts.push({ text: plain(text).toUpperCase(), t: 0 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  /** O humano da vez pode mexer (mirar, bola na mão, bater). */
  private humanTurn(): boolean {
    return this.phase === 'aim' && !this.isCpu(this.match.turn);
  }

  /** Mira na bola permitida mais perto (início de vez). */
  private aimAtNearest() {
    const targets = legalTargets(this.match, this.balls);
    let best: Ball | null = null;
    let bd = Infinity;
    for (const b of this.balls) {
      if (!b.on || !targets.includes(b.n)) continue;
      const d = (b.x - this.cue.x) ** 2 + (b.y - this.cue.y) ** 2;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) this.aim = Math.atan2(best.y - this.cue.y, best.x - this.cue.x);
  }

  // ------------------------------------------------------------------ tacada

  shoot() {
    if (!this.humanTurn() || this.draggingCue) return;
    this.startStroke();
  }

  private startStroke() {
    this.phase = 'stroke';
    this.strokeT = 0;
    this.emitHud();
  }

  private fire() {
    this.before = cloneBalls(this.balls);
    this.events = newEvents();
    this.acc = 0;
    this.cue.vx = Math.cos(this.aim) * this.power * MAX_SPEED;
    this.cue.vy = Math.sin(this.aim) * this.power * MAX_SPEED;
    sfx.cue(this.power);
    this.phase = 'rolling';
    this.emitHud();
  }

  private endShot() {
    const prev = this.match;
    const res = resolveShot(prev, this.before, this.events);
    const next = res.state;
    for (const m of res.messages) this.toast(m);
    if (res.respotCastigo) {
      const c = this.balls.find((b) => b.n === RULES[prev.rules].castigo)!;
      const p = footSpot(this.balls);
      Object.assign(c, { x: p.x, y: p.y, on: true });
    }
    if (res.foul) {
      this.toast(`Falta: ${res.foul}`);
      sfx.foul();
    }
    if (res.assigned) this.toast(`${this.name(prev.turn)}: ${RULES[prev.rules].names[res.assigned]}`);
    this.match = next;

    if (next.winner !== null) {
      this.wins[next.winner]++;
      this.phase = 'over';
      if (this.settings.mode === 'pvc' && next.winner === 1) sfx.lose();
      else sfx.win();
      this.emitHud();
      return;
    }
    if (res.respotCue) {
      const spot = this.freeCueSpot();
      Object.assign(this.cue, { x: spot.x, y: spot.y, on: true });
    }
    this.lastValidCue = { x: this.cue.x, y: this.cue.y };
    if (next.turn !== prev.turn) {
      this.toast(`Vez de ${this.name(next.turn)}${next.ballInHand ? ' - bola na mao' : ''}`);
      sfx.turn();
    }
    const p = next.turn;
    if (onCastigo(next, this.balls, p) && !onCastigo(prev, this.before, p)) {
      this.toast(`${this.name(p)} agora mata a bola ${RULES[next.rules].castigo}`);
    }
    this.phase = 'aim';
    this.aimAtNearest();
    this.emitHud();
  }

  /** Onde a branca volta depois de cair: a marca da cabeceira ou o lugar livre mais perto dela. */
  private freeCueSpot(): { x: number; y: number } {
    for (let r = 0; r < 60; r += 2) {
      for (const [dx, dy] of [[0, 0], [-r, 0], [0, -r], [0, r], [r, 0]]) {
        const x = HEAD_X - 8 + dx;
        const y = CY + dy;
        if (canPlaceCue(this.balls, x, y, false, HEAD_X)) return { x, y };
      }
    }
    return { x: HEAD_X - 8, y: CY };
  }

  // ------------------------------------------------------------------ entrada

  setPower(p: number) {
    this.power = Math.max(0.05, Math.min(1, p));
    this.emitHud();
  }

  /** Gira a mira em graus (botões ◀ ▶). */
  rotate(deg: number) {
    if (!this.humanTurn()) return;
    this.aim += (deg * Math.PI) / 180;
  }

  private canPlace(x: number, y: number) {
    return canPlaceCue(this.balls, x, y, this.match.ballInHand === 'kitchen', HEAD_X);
  }

  pointerDown(x: number, y: number) {
    if (!this.humanTurn()) return;
    this.pressed = true;
    if (this.match.ballInHand && Math.hypot(x - this.cue.x, y - this.cue.y) < BALL_R + 5) {
      this.draggingCue = true;
      this.lastValidCue = { x: this.cue.x, y: this.cue.y };
      return;
    }
    this.aimAt(x, y);
  }

  pointerMove(x: number, y: number) {
    if (!this.pressed || !this.humanTurn()) return;
    if (this.draggingCue) {
      this.cue.x = x;
      this.cue.y = y;
      if (this.canPlace(x, y)) this.lastValidCue = { x, y };
      return;
    }
    this.aimAt(x, y);
  }

  pointerUp() {
    this.pressed = false;
    if (this.draggingCue) {
      this.draggingCue = false;
      this.cue.x = this.lastValidCue.x;
      this.cue.y = this.lastValidCue.y;
    }
  }

  private aimAt(x: number, y: number) {
    if (Math.hypot(x - this.cue.x, y - this.cue.y) > 2) this.aim = Math.atan2(y - this.cue.y, x - this.cue.x);
  }

  /** Teclado. Devolve true se a tecla foi usada. */
  keyDown(code: string, shift: boolean): boolean {
    if (!this.humanTurn()) return code === 'Space';
    const step = ((shift ? AIM_FINE_DEG : AIM_STEP_DEG) * Math.PI) / 180;
    switch (code) {
      case 'ArrowLeft':
        this.aim -= step;
        return true;
      case 'ArrowRight':
        this.aim += step;
        return true;
      case 'ArrowUp':
        this.setPower(this.power + POWER_STEP);
        return true;
      case 'ArrowDown':
        this.setPower(this.power - POWER_STEP);
        return true;
      case 'Space':
      case 'Enter':
        this.shoot();
        return true;
    }
    if (this.match.ballInHand) {
      const mv: Record<string, [number, number]> = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
      const d = mv[code];
      if (d) {
        const x = this.cue.x + d[0] * (shift ? 0.5 : 2);
        const y = this.cue.y + d[1] * (shift ? 0.5 : 2);
        if (this.canPlace(x, y)) {
          this.cue.x = x;
          this.cue.y = y;
          this.lastValidCue = { x, y };
        }
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ computador

  private createWorker(): Worker | null {
    try {
      const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<AiResponse>) => this.onAiShot(e.data);
      w.onerror = () => {
        // sem worker (navegador antigo, erro de carga): passa a pensar na própria thread
        w.terminate();
        if (this.worker === w) this.worker = null;
        if (this.cpu && !this.cpu.shot) this.requestAi();
      };
      return w;
    } catch {
      return null;
    }
  }

  private requestAi() {
    const req: AiRequest = { id: ++this.aiId, balls: cloneBalls(this.balls), state: this.match, level: this.settings.level };
    if (this.worker) {
      this.worker.postMessage(req);
      return;
    }
    setTimeout(() => {
      if (req.id !== this.aiId) return;
      this.onAiShot({ id: req.id, shot: chooseShot(req.balls, req.state, req.level) });
    }, 30);
  }

  private onAiShot(res: AiResponse) {
    if (res.id !== this.aiId || !this.cpu) return;
    this.cpu.shot = res.shot;
  }

  private cancelCpu() {
    this.aiId++;
    this.cpu = null;
  }

  private updateCpu(dt: number) {
    if (this.phase !== 'aim' || !this.isCpu(this.match.turn)) return;
    if (!this.cpu) {
      this.cpu = { stage: 'think', t: 0, shot: null, from: this.aim };
      this.requestAi();
      this.emitHud();
      return;
    }
    const c = this.cpu;
    c.t += dt;
    if (c.stage === 'think') {
      if (!c.shot || c.t < AI_THINK_S) return;
      if (c.shot.cue && this.match.ballInHand) {
        this.cue.x = c.shot.cue.x;
        this.cue.y = c.shot.cue.y;
        this.cue.on = true;
      }
      c.stage = 'aim';
      c.t = 0;
      c.from = this.aim;
      this.power = c.shot.power;
      this.emitHud();
      return;
    }
    const shot = c.shot!;
    let d = shot.angle - c.from;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = Math.min(1, c.t / AI_AIM_S);
    this.aim = c.from + d * (1 - (1 - k) ** 3);
    if (k >= 1) {
      this.aim = shot.angle;
      this.cpu = null;
      this.startStroke();
    }
  }

  // ------------------------------------------------------------------ laço

  update(dt: number) {
    this.time += dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < TOAST_S);
    for (const s of this.sinks) s.t += dt;
    this.sinks = this.sinks.filter((s) => s.t < SINK_S);

    if (this.phase === 'stroke') {
      this.strokeT += dt;
      if (this.strokeT >= STROKE_S) this.fire();
    } else if (this.phase === 'rolling') {
      this.acc += dt;
      while (this.acc >= PHYS_DT) {
        step(this.balls, this.events, this.listener);
        this.acc -= PHYS_DT;
      }
      if (!anyMoving(this.balls)) this.endShot();
    } else {
      this.updateCpu(dt);
    }
  }

  private emitHud() {
    const m = this.match;
    const { castigo, names } = RULES[m.rules];
    const players = ([0, 1] as const).map((p) => {
      const g = m.groups[p];
      return {
        name: this.name(p),
        cpu: this.isCpu(p),
        group: g ? names[g] : null,
        left: g ? remaining(this.balls, g, m.rules).length : 7,
        onCastigo: onCastigo(m, this.balls, p),
        wins: this.wins[p],
      };
    }) as HudState['players'];
    const hud: HudState = {
      players,
      turn: m.turn,
      castigo,
      canShoot: this.humanTurn(),
      power: Math.round(this.power * 100) / 100,
      ballInHand: !!m.ballInHand && this.humanTurn(),
      thinking: this.phase === 'aim' && this.isCpu(m.turn),
      winner: m.winner,
      endReason: m.endReason,
    };
    const key = JSON.stringify(hud);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.onHud(hud);
  }

  // ------------------------------------------------------------------ desenho

  render(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    blit(ctx, this.hi.fundo, 0, 0);

    const m = this.match;
    const human = this.humanTurn();
    if (human && m.ballInHand === 'kitchen') {
      ctx.fillStyle = 'rgba(244, 239, 226, 0.07)';
      ctx.fillRect(FELT_L, FELT_T, HEAD_X - FELT_L, FELT_B - FELT_T);
    }

    for (const b of this.balls) if (b.on) blit(ctx, this.hi.sombra, snap(b.x - BALL_R + 1), snap(b.y - BALL_R + 1));
    for (const s of this.sinks) {
      const k = s.t / SINK_S;
      ctx.globalAlpha = 1 - k;
      blit(ctx, this.hi[`b${s.n}`], snap(s.x + (s.px - s.x) * k - BALL_R), snap(s.y + (s.py - s.y) * k - BALL_R));
      ctx.globalAlpha = 1;
    }

    const aiming = (this.phase === 'aim' || this.phase === 'stroke') && this.cue.on && !this.draggingCue;
    if (aiming && human) this.drawGuide(ctx);

    for (const b of this.balls) if (b.on) blit(ctx, this.hi[`b${b.n}`], snap(b.x - BALL_R), snap(b.y - BALL_R));

    if (human && m.ballInHand) {
      const ok = this.canPlace(this.cue.x, this.cue.y);
      if (Math.floor(this.time * (ok ? 2 : 8)) % 2 === 0) blit(ctx, this.hi.mira, snap(this.cue.x - BALL_R), snap(this.cue.y - BALL_R));
    }
    if (aiming && (this.phase === 'stroke' || !this.cpu || this.cpu.stage === 'aim')) this.drawCue(ctx);

    this.drawHud(ctx);
    this.drawToasts(ctx);
  }

  private drawGuide(ctx: CanvasRenderingContext2D) {
    const c = this.cue;
    const hit = castRay(this.balls, c.x, c.y, this.aim);
    const dx = Math.cos(this.aim);
    const dy = Math.sin(this.aim);
    const legal = hit.ball ? legalTargets(this.match, this.balls).includes(hit.ball.n) : true;
    ctx.fillStyle = 'rgba(244, 239, 226, 0.75)';
    for (let t = BALL_R + 3; t < hit.dist; t += 3) ctx.fillRect(snap(c.x + dx * t), snap(c.y + dy * t), 1, 1);
    const gx = c.x + dx * hit.dist;
    const gy = c.y + dy * hit.dist;
    blit(ctx, this.hi.mira, snap(gx - BALL_R), snap(gy - BALL_R));
    if (!hit.ball) return;
    // para onde a bola vai (linha dos centros) e para onde a branca desvia (tangente)
    const ox = hit.ball.x - gx;
    const oy = hit.ball.y - gy;
    const od = Math.hypot(ox, oy) || 1;
    const ux = ox / od;
    const uy = oy / od;
    ctx.fillStyle = legal ? '#ffd36b' : '#ff4d5e';
    for (let t = BALL_R + 2; t < BALL_R + 22; t += 2) ctx.fillRect(snap(hit.ball.x + ux * t), snap(hit.ball.y + uy * t), 1, 1);
    if (!legal) {
      ctx.fillRect(snap(hit.ball.x - 1), snap(hit.ball.y - BALL_R - 4), 2, 2);
    }
    const dot = dx * ux + dy * uy;
    const tx = dx - ux * dot;
    const ty = dy - uy * dot;
    const tl = Math.hypot(tx, ty);
    if (tl > 0.05) {
      ctx.fillStyle = 'rgba(244, 239, 226, 0.45)';
      for (let t = BALL_R + 2; t < BALL_R + 2 + 14 * tl; t += 2) ctx.fillRect(snap(gx + (tx / tl) * t), snap(gy + (ty / tl) * t), 1, 1);
    }
  }

  private drawCue(ctx: CanvasRenderingContext2D) {
    const c = this.cue;
    const dx = Math.cos(this.aim);
    const dy = Math.sin(this.aim);
    let pull = this.power * CUE_PULL;
    if (this.phase === 'stroke') {
      const k = Math.min(1, this.strokeT / STROKE_S);
      pull *= 1 - k * k;
    }
    const start = BALL_R + 1.5 + pull;
    const seg = (from: number, to: number, w: number, color: string, ox = 0, oy = 0) => {
      ctx.fillStyle = color;
      for (let t = from; t < to; t += 0.5) {
        ctx.fillRect(snap(c.x - dx * (start + t) - w / 2 + ox), snap(c.y - dy * (start + t) - w / 2 + oy), w, w);
      }
    };
    seg(0, CUE_LENGTH, 2, 'rgba(8, 30, 16, 0.35)', 2, 2);
    seg(0, 1.5, 1, '#4a7ad0');
    seg(1.5, 3.5, 1, '#f4efe2');
    seg(3.5, 70, 1, '#d9b878');
    seg(70, 76, 1.5, '#e8c890');
    seg(76, 78, 2, '#f4efe2');
    seg(78, CUE_LENGTH, 2, '#5a2a14');
    seg(CUE_LENGTH - 3, CUE_LENGTH, 2, '#1b1220');
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    const m = this.match;
    const { castigo } = RULES[m.rules];
    const boxes = [BOX_L, BOX_R];
    for (const p of [0, 1] as const) {
      const [x0, y0, x1, y1] = boxes[p];
      const active = m.turn === p && m.winner === null;
      if (active) {
        ctx.fillStyle = Math.floor(this.time * 2) % 2 === 0 || this.phase !== 'aim' ? '#ffd36b' : '#b8973e';
        ctx.fillRect(x0, y0, x1 - x0 + 1, 1);
        ctx.fillRect(x0, y1, x1 - x0 + 1, 1);
        ctx.fillRect(x0, y0, 1, y1 - y0 + 1);
        ctx.fillRect(x1, y0, 1, y1 - y0 + 1);
      }
      const name = plain(this.name(p)).toUpperCase().slice(0, 16);
      const thinking = active && this.isCpu(p) && this.phase === 'aim' ? '.'.repeat(1 + (Math.floor(this.time * 3) % 3)) : '';
      drawPixelText(ctx, name + thinking, x0 + 4, y0 + 4, active ? '#ffd36b' : '#f4efe2');
      const wins = String(this.wins[p]);
      drawPixelText(ctx, wins, x1 - 3 - textWidth(wins), y0 + 4, '#5fd17a');
      const g = m.groups[p];
      if (g === null) {
        drawPixelText(ctx, 'MESA ABERTA', x0 + 4, y0 + 14, '#c9c0d8');
      } else if (onCastigo(m, this.balls, p)) {
        drawPixelText(ctx, 'MATA A', x0 + 4, y0 + 14, '#ff8ad8');
        blit(ctx, this.hi[`b${castigo}`], x0 + 4 + textWidth('MATA A') + 3, y0 + 12);
      } else {
        const left = this.balls.filter((b) => b.on && groupOf(b.n, m.rules) === g).map((b) => b.n);
        let x = x0 + 4;
        for (const n of left) {
          blit(ctx, this.hi[`b${n}`], x, y0 + 12);
          x += 9;
        }
        const label = plain(RULES[m.rules].short[g]).toUpperCase();
        drawPixelText(ctx, label, x1 - 3 - textWidth(label), y0 + 14, '#c9c0d8');
      }
    }
  }

  private drawToasts(ctx: CanvasRenderingContext2D) {
    const shown = this.toasts.slice(-2);
    let y = FELT_B - 14 - (shown.length - 1) * 11;
    for (const t of shown) {
      const w = textWidth(t.text) + 8;
      const x = Math.round(MID_X - w / 2);
      const a = Math.min(1, (TOAST_S - t.t) / 0.3);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(22, 18, 31, 0.85)';
      ctx.fillRect(x, y, w, 9);
      drawPixelText(ctx, t.text, x + 4, y + 2, t.text.startsWith('FALTA') ? '#ff4d5e' : '#f4efe2');
      ctx.globalAlpha = 1;
      y += 11;
    }
  }
}

/** Meio pixel lógico = 1 pixel de tela: movimento suave sem borrar. */
function snap(v: number) {
  return Math.round(v * SCALE) / SCALE;
}
