import type { Assets, AssetKey } from './assets';
import { blit, blitPart, SCALE, upscaleAll } from './hires';
import {
  BELTS,
  BOMBS_FROM_SCORE,
  BOX_SIZE,
  CATCH_RECT,
  CHEF_POS,
  DIZZY_TIME,
  DOG_FRAME,
  DOG_MAX_X,
  DOG_MIN_X,
  DOG_SPEED,
  DOG_TURBO_SPEED,
  DOG_Y,
  GRAU_LIFT,
  GRAVITY,
  GROUND_Y,
  H,
  IMA_RANGE,
  MAX_LIVES,
  POWER_DURATION,
  RESTAURANT_POS,
  SPAWN_POS,
  START_LIVES,
  W,
} from './constants';
import type { Input } from './input';
import { drawPixelText, textWidth } from './pixelFont';
import { loadRecord, saveRecord } from './record';
import type { Box, BoxKind, HudState, NormalLook, PowerKind } from './types';

/**
 * Desvio no fim de uma esteira. Troca a cada pacote que passa: se o primeiro foi para a esteira de
 * baixo, o segundo vai para a rua, o terceiro desce de novo, e assim por diante.
 */
interface Desvio {
  /** Destino do PRÓXIMO pacote que chegar à ponta. */
  state: 'desce' | 'rua';
  /** Segundos restantes do pisca que avisa que o desvio acabou de trocar. */
  flash: number;
}

interface Fx {
  kind: 'brilho' | 'explosao' | 'amassada' | 'poeira';
  x: number;
  y: number;
  t: number;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const POWER_LABEL: Record<PowerKind, string> = { turbo: 'TURBO!', grau: 'GRAU!', ima: 'IMA!', dobro: 'X2!' };
/** Quanto tempo o desvio pisca depois de trocar (só um aviso visual). */
const FLASH_TIME = 0.5;
const GAME_OVER_DELAY = 1.2;

type Rng = () => number;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class CachorroLokoEngine {
  private boxes: Box[] = [];
  private nextId = 1;
  private dog = { x: 140, facing: 1 as 1 | -1, moving: false, dizzy: 0, dust: 0 };
  private score = 0;
  private lives = START_LIVES;
  private record = loadRecord();
  private startRecord = this.record;
  private powers: Record<PowerKind, number> = { turbo: 0, grau: 0, ima: 0, dobro: 0 };
  private desvios: Desvio[] = [];
  private spawnTimer = 1;
  private sinceSpecial = 0;
  private chefThrow = 0;
  private beltPhase = 0;
  private time = 0;
  private phase: HudState['phase'] = 'playing';
  private overTimer = 0;
  private fx: Fx[] = [];
  private popups: Popup[] = [];
  private lastHud = '';
  private readonly staticLayer: HTMLCanvasElement;
  /** Sprites em alta (Scale2x), usados só no desenho. */
  private readonly hi: Record<AssetKey, HTMLCanvasElement>;

  constructor(
    assets: Assets,
    private readonly input: Input,
    private readonly onHud: (hud: HudState) => void,
    private readonly rng: Rng = Math.random,
  ) {
    this.hi = upscaleAll(assets);
    this.staticLayer = this.buildStaticLayer();
    this.restart();
  }

  // ------------------------------------------------------------ dificuldade

  /** Nível começa em 1 e sobe a cada 10 entregas. */
  get level() {
    return Math.floor(this.score / 10) + 1;
  }
  private get beltSpeed() {
    return Math.min(24 + (this.level - 1) * 4, 64);
  }
  private get spawnEvery() {
    return Math.max(3.4 * Math.pow(0.9, this.level - 1), 1.1);
  }

  // ------------------------------------------------------------ controle

  restart() {
    this.boxes = [];
    this.dog = { x: 140, facing: 1, moving: false, dizzy: 0, dust: 0 };
    this.score = 0;
    this.lives = START_LIVES;
    this.record = loadRecord();
    this.startRecord = this.record;
    this.powers = { turbo: 0, grau: 0, ima: 0, dobro: 0 };
    this.desvios = [0, 1, 2].map(() => ({ state: this.rng() < 0.5 ? 'desce' : 'rua', flash: 0 }));
    this.spawnTimer = 1;
    this.sinceSpecial = 0;
    this.fx = [];
    this.popups = [];
    this.phase = 'playing';
    this.overTimer = 0;
    this.lastHud = '';
    this.emit();
  }

  setPaused(paused: boolean) {
    if (this.phase === 'over') return;
    this.phase = paused ? 'paused' : 'playing';
    this.input.clear();
    this.emit();
  }

  get isPaused() {
    return this.phase === 'paused';
  }

  // ------------------------------------------------------------ update

  update(dtRaw: number) {
    // o 1º quadro do requestAnimationFrame pode vir com tempo negativo
    const dt = Math.max(0, Math.min(dtRaw, 0.05));
    if (this.phase === 'paused') return;
    this.time += dt;
    this.updateEffects(dt);

    if (this.phase === 'over') {
      this.overTimer += dt;
      return;
    }

    for (const k of Object.keys(this.powers) as PowerKind[]) this.powers[k] = Math.max(0, this.powers[k] - dt);
    this.updateDog(dt);
    this.beltPhase += this.beltSpeed * dt;
    this.updateDesvios(dt);

    this.chefThrow -= dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.canSpawn()) {
        this.spawn();
        this.spawnTimer = this.spawnEvery * (0.85 + this.rng() * 0.3);
      } else {
        this.spawnTimer = 0.25;
      }
    }

    this.updateBoxes(dt);
    this.emit();
  }

  private updateDog(dt: number) {
    const d = this.dog;
    if (d.dizzy > 0) {
      d.dizzy -= dt;
      d.moving = false;
      return;
    }
    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const speed = this.powers.turbo > 0 ? DOG_TURBO_SPEED : DOG_SPEED;
    d.x = Math.min(DOG_MAX_X, Math.max(DOG_MIN_X, d.x + dir * speed * dt));
    d.moving = dir !== 0;
    if (dir !== 0) d.facing = dir as 1 | -1;
    if (d.moving) {
      d.dust -= dt;
      if (d.dust <= 0) {
        const rearX = d.facing > 0 ? d.x + 4 : d.x + DOG_FRAME - 16;
        this.fx.push({ kind: 'poeira', x: rearX, y: DOG_Y + 32, t: 0 });
        d.dust = 0.14;
      }
    }
  }

  /** Só o pisca de aviso: quem troca o desvio é a passagem de cada pacote (ver `updateBoxes`). */
  private updateDesvios(dt: number) {
    for (const d of this.desvios) d.flash = Math.max(0, d.flash - dt);
  }

  private canSpawn() {
    // não empilha pacotes na boca da esteira
    return !this.boxes.some((b) => (b.state === 'chute' || (b.state === 'belt' && b.belt === 0)) && b.x < SPAWN_POS.x + 18);
  }

  private pickKind(): BoxKind {
    const r = this.rng;
    if (this.score >= BOMBS_FROM_SCORE && r() < 0.1 + Math.min(0.08, (this.level - 2) * 0.01)) return 'bomba';
    this.sinceSpecial++;
    if ((this.sinceSpecial >= 5 && r() < 0.22) || this.sinceSpecial >= 11) {
      this.sinceSpecial = 0;
      const pool: [BoxKind, number][] = [
        ['turbo', 1],
        ['grau', 1],
        ['ima', 1],
        ['dobro', 1],
        ['vida', this.lives < MAX_LIVES ? 0.7 : 0],
      ];
      const total = pool.reduce((s, [, w]) => s + w, 0);
      let x = r() * total;
      for (const [k, w] of pool) {
        x -= w;
        if (x <= 0) return k;
      }
    }
    return 'normal';
  }

  private spawn() {
    const looks: NormalLook[] = ['caixa', 'caixa', 'pizza', 'sacola'];
    this.boxes.push({
      id: this.nextId++,
      kind: this.pickKind(),
      look: looks[Math.floor(this.rng() * looks.length)],
      x: SPAWN_POS.x,
      y: SPAWN_POS.y,
      vx: 0,
      vy: 0,
      state: 'chute',
      belt: 0,
    });
    this.chefThrow = 0.3;
  }

  private updateBoxes(dt: number) {
    const speed = this.beltSpeed;
    const remove = new Set<number>();
    const catchRect = this.catchRect();

    for (const b of this.boxes) {
      switch (b.state) {
        case 'chute': {
          b.vy += GRAVITY * dt;
          b.y += b.vy * dt;
          if (b.y + BOX_SIZE >= BELTS[0].y) {
            b.y = BELTS[0].y - BOX_SIZE;
            b.vy = 0;
            b.state = 'belt';
            b.belt = 0;
          }
          break;
        }
        case 'belt': {
          const belt = BELTS[b.belt];
          b.x += belt.dir * speed * dt;
          const cx = b.x + BOX_SIZE / 2;
          const atEnd = belt.dir > 0 ? cx >= belt.x1 : cx <= belt.x0;
          if (!atEnd) break;
          const last = b.belt === BELTS.length - 1;
          const desvio = last ? null : this.desvios[b.belt];
          const goesDown = desvio?.state === 'desce';
          if (desvio) {
            // cada pacote que passa troca o desvio para o próximo
            desvio.state = goesDown ? 'rua' : 'desce';
            desvio.flash = FLASH_TIME;
          }
          if (goesDown) {
            b.state = 'drop';
            b.vx = belt.dir * 12;
            b.vy = 0;
          } else {
            b.state = 'street';
            b.vx = belt.dir * (18 + this.rng() * 10);
            b.vy = -30;
          }
          break;
        }
        case 'drop': {
          const next = BELTS[b.belt + 1];
          b.vy += GRAVITY * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y + BOX_SIZE >= next.y) {
            b.y = next.y - BOX_SIZE;
            b.x = Math.min(next.x1 - BOX_SIZE, Math.max(next.x0, b.x));
            b.vx = 0;
            b.vy = 0;
            b.belt++;
            b.state = 'belt';
          }
          break;
        }
        case 'street': {
          if (this.powers.ima > 0 && b.y > 70) {
            // ímã: puxa suavemente para o centro da área de pega, sem passar do ponto
            const dx = catchRect.x + catchRect.w / 2 - (b.x + BOX_SIZE / 2);
            if (Math.abs(dx) < IMA_RANGE) b.vx = Math.max(-160, Math.min(160, dx * 6));
          }
          b.vy += GRAVITY * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (overlaps({ x: b.x, y: b.y, w: BOX_SIZE, h: BOX_SIZE }, catchRect)) {
            this.onCatch(b);
            remove.add(b.id);
          } else if (b.y + BOX_SIZE >= GROUND_Y) {
            this.onLand(b);
            remove.add(b.id);
          } else if (b.x < -BOX_SIZE - 4 || b.x > W + 4) {
            // saiu pela lateral: conta como perdido
            this.onLand(b);
            remove.add(b.id);
          }
          break;
        }
      }
    }
    if (remove.size) this.boxes = this.boxes.filter((b) => !remove.has(b.id));
  }

  /** Área que pega pacotes (sobe com o grau, espelha com a direção). */
  private catchRect(): Rect {
    const r = CATCH_RECT;
    const lift = this.powers.grau > 0 ? GRAU_LIFT : 0;
    const rx = this.dog.facing > 0 ? r.x : DOG_FRAME - r.x - r.w;
    return { x: this.dog.x + rx, y: DOG_Y + r.y - lift, w: r.w, h: r.h + lift };
  }

  private onCatch(b: Box) {
    const cx = b.x + BOX_SIZE / 2;
    const cy = b.y + BOX_SIZE / 2;
    if (b.kind === 'bomba') {
      this.fx.push({ kind: 'explosao', x: cx, y: cy, t: 0 });
      this.popups.push({ text: '-1', x: cx, y: cy - 10, t: 0, color: '#ff4d5e' });
      this.dog.dizzy = DIZZY_TIME;
      this.loseLife();
      return;
    }
    const points = this.powers.dobro > 0 ? 2 : 1;
    this.score += points;
    if (this.score > this.record) this.record = this.score;
    this.fx.push({ kind: 'brilho', x: cx, y: cy, t: 0 });
    this.popups.push({ text: `+${points}`, x: cx, y: cy - 8, t: 0, color: '#ffd36b' });

    if (b.kind === 'vida') {
      this.lives = Math.min(MAX_LIVES, this.lives + 1);
      this.popups.push({ text: '+1 VIDA', x: cx, y: cy - 18, t: 0, color: '#ff8a96' });
    } else if (b.kind !== 'normal') {
      this.powers[b.kind] = POWER_DURATION[b.kind];
      this.popups.push({ text: POWER_LABEL[b.kind], x: cx, y: cy - 18, t: 0, color: '#9fe0ff' });
    }
  }

  private onLand(b: Box) {
    const cx = b.x + BOX_SIZE / 2;
    if (b.kind === 'bomba') {
      this.fx.push({ kind: 'explosao', x: cx, y: GROUND_Y - 6, t: 0 });
      return;
    }
    this.fx.push({ kind: 'amassada', x: Math.max(0, Math.min(W - 14, cx - 7)), y: GROUND_Y - 6, t: 0 });
    this.popups.push({ text: '-1', x: cx, y: GROUND_Y - 20, t: 0, color: '#ff4d5e' });
    this.loseLife();
  }

  private loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'over';
      this.dog.dizzy = 999;
      if (this.score > this.startRecord) saveRecord(this.score);
      this.emit();
    }
  }

  private updateEffects(dt: number) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'amassada' ? 1.6 : f.kind === 'explosao' ? 0.45 : 0.3));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 0.9);
  }

  // ------------------------------------------------------------ render

  private buildStaticLayer(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W * SCALE;
    c.height = H * SCALE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.scale(SCALE, SCALE);
    const a = this.hi;
    blit(ctx, a.fundo_rua, 0, 0);
    // pés das esteiras: das pontas até a calçada
    for (const b of BELTS) {
      for (const lx of [b.x0 + 10, b.x1 - 14]) {
        for (let y = b.y + 8; y < 176; y += 16) blit(ctx, a.esteira_pe, lx, Math.min(y, 160));
      }
    }
    blit(ctx, a.restaurante, RESTAURANT_POS.x, RESTAURANT_POS.y);
    return c;
  }

  /** Desenha em um canvas de W·SCALE × H·SCALE; as coordenadas continuam lógicas (320×200). */
  render(ctx: CanvasRenderingContext2D) {
    const a = this.hi;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.staticLayer, 0, 0, W, H);
    blit(ctx, this.chefThrow > 0 ? a.chapeiro_1 : a.chapeiro_0, CHEF_POS.x, CHEF_POS.y);

    this.drawBelts(ctx);

    for (const b of this.boxes) if (b.state !== 'street') this.drawBox(ctx, b);
    for (const f of this.fx) if (f.kind === 'amassada' || f.kind === 'poeira') this.drawFx(ctx, f);
    this.drawDog(ctx);
    for (const b of this.boxes) if (b.state === 'street') this.drawBox(ctx, b);
    for (const f of this.fx) if (f.kind === 'brilho' || f.kind === 'explosao') this.drawFx(ctx, f);

    for (const p of this.popups) {
      const y = p.y - p.t * 16;
      drawPixelText(ctx, p.text, p.x - textWidth(p.text) / 2, y, p.color);
    }
  }

  private drawBelts(ctx: CanvasRenderingContext2D) {
    const a = this.hi;
    const step = ((Math.floor(this.beltPhase) % 4) + 4) % 4;
    BELTS.forEach((b, i) => {
      // as listras andam no sentido da esteira
      const f = b.dir > 0 ? (4 - step) % 4 : step;
      const tile = a[`esteira_${f}` as AssetKey];
      for (let x = b.x0; x < b.x1; x += 16) {
        const w = Math.min(16, b.x1 - x);
        blitPart(ctx, tile, 0, 0, w, 8, x, b.y, w, 8);
      }
      blit(ctx, a[`esteira_ponta_esq_${f}` as AssetKey], b.x0 - 5, b.y);
      blit(ctx, a[`esteira_ponta_dir_${f}` as AssetKey], b.x1 - 1, b.y);

      if (i < this.desvios.length) {
        const d = this.desvios[i];
        // logo depois de trocar, pisca entre o destino antigo e o novo
        const old = d.state === 'desce' ? 'rua' : 'desce';
        const shown = d.flash > 0 && Math.floor(this.time * 16) % 2 === 0 ? old : d.state;
        const img = shown === 'desce' ? a.desvio_desce : a.desvio_rua;
        const x = b.dir > 0 ? b.x1 : b.x0 - 8;
        if (b.dir > 0) {
          blit(ctx, img, x, b.y - 12);
        } else {
          ctx.save();
          ctx.translate(x + 8, b.y - 12);
          ctx.scale(-1, 1);
          blit(ctx, img, 0, 0);
          ctx.restore();
        }
      }
    });
  }

  private boxImage(b: Box): HTMLCanvasElement {
    const a = this.hi;
    if (b.kind === 'normal') return a[b.look];
    if (b.kind === 'bomba') return Math.floor(this.time * 6) % 2 ? a.bomba_1 : a.bomba_0;
    return a[b.kind];
  }

  private drawBox(ctx: CanvasRenderingContext2D, b: Box) {
    blit(ctx, this.boxImage(b), Math.round(b.x * SCALE) / SCALE, Math.round(b.y * SCALE) / SCALE);
  }

  private drawDog(ctx: CanvasRenderingContext2D) {
    const a = this.hi;
    const d = this.dog;
    if (d.dizzy > 0 && this.phase !== 'over' && Math.floor(this.time * 12) % 2 === 0) return; // pisca
    const frame = d.moving ? Math.floor(this.time * 10) % 2 : 0;
    let img: HTMLCanvasElement;
    if (d.dizzy > 0) img = a.cachorro_tonto;
    else if (this.powers.grau > 0) img = frame ? a.cachorro_grau_1 : a.cachorro_grau_0;
    else if (this.powers.turbo > 0) img = frame ? a.cachorro_turbo_1 : a.cachorro_turbo_0;
    else img = frame ? a.cachorro_1 : a.cachorro_0;

    const x = Math.round(d.x * SCALE) / SCALE;
    if (d.facing > 0) {
      blit(ctx, img, x, DOG_Y);
    } else {
      ctx.save();
      ctx.translate(x + DOG_FRAME, DOG_Y);
      ctx.scale(-1, 1);
      blit(ctx, img, 0, 0);
      ctx.restore();
    }

    if (this.powers.ima > 0) {
      // faíscas do ímã em volta do baú
      ctx.fillStyle = Math.floor(this.time * 8) % 2 ? '#ff4d5e' : '#f4efe2';
      const r = this.catchRect();
      const t = this.time * 6;
      for (let i = 0; i < 3; i++) {
        const ang = t + (i * Math.PI * 2) / 3;
        ctx.fillRect(Math.round(r.x + r.w / 2 + Math.cos(ang) * 20), Math.round(r.y + 4 + Math.sin(ang) * 8), 1, 1);
      }
    }
  }

  private drawFx(ctx: CanvasRenderingContext2D, f: Fx) {
    const a = this.hi;
    switch (f.kind) {
      case 'brilho': {
        const i = Math.min(2, Math.floor(f.t / 0.1));
        blit(ctx, a[`brilho_${i}` as AssetKey], Math.round(f.x - 6), Math.round(f.y - 6));
        break;
      }
      case 'poeira': {
        const i = Math.min(2, Math.floor(f.t / 0.1));
        blit(ctx, a[`poeira_${i}` as AssetKey], Math.round(f.x - 6), Math.round(f.y));
        break;
      }
      case 'explosao': {
        const i = Math.min(2, Math.floor(f.t / 0.15));
        blit(ctx, a[`explosao_${i}` as AssetKey], Math.round(f.x - 12), Math.round(f.y - 12));
        break;
      }
      case 'amassada': {
        ctx.save();
        ctx.globalAlpha = f.t > 1.1 ? Math.max(0, 1 - (f.t - 1.1) / 0.5) : 1;
        blit(ctx, a.caixa_amassada, Math.round(f.x), Math.round(f.y));
        ctx.restore();
        break;
      }
    }
  }

  // ------------------------------------------------------------ hud

  private emit() {
    const powers: HudState['powers'] = {};
    for (const k of Object.keys(this.powers) as PowerKind[]) {
      if (this.powers[k] > 0) powers[k] = Math.ceil(this.powers[k]);
    }
    const hud: HudState = {
      phase: this.phase,
      score: this.score,
      record: this.record,
      newRecord: this.score > this.startRecord && this.score > 0,
      lives: this.lives,
      level: this.level,
      powers,
    };
    const key = JSON.stringify(hud);
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.onHud(hud);
  }

  /** Para o HUD saber quando já pode mostrar a tela de fim de jogo. */
  get gameOverReady() {
    return this.phase === 'over' && this.overTimer >= GAME_OVER_DELAY;
  }
}
