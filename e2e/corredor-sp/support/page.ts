import { expect, type Locator, type Page } from '@playwright/test';
import { BREEDS, CATEGORIES, COLORS, MODELS, TRACKS, type BreedId, type CategoryId, type TrackId } from '../../../src/games/corredor-sp/game/data';
import type { CorredorE2E, TouchName } from '../../../src/games/corredor-sp/game/e2eHook';
import type { CorredorSnapshot } from '../../../src/games/corredor-sp/game/engine';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, FPS, type BaseBootOptions } from '../../support/game-page';

export const CHOICE_KEY = 'corredor-sp:escolha';
export const SOUND_KEY = 'corredor-sp:som';
export const recordKey = (track: TrackId): string => `corredor-sp:recorde:${track}`;

export interface Choice {
  track: TrackId;
  breed: BreedId;
  category: CategoryId;
  modelId: string;
  colorId: string;
}

/** Quadros da contagem regressiva (3 s) com folga de alguns quadros. */
export const COUNTDOWN_FRAMES = 3 * FPS + 2;

const TOUCH_LABEL: Record<TouchName, string> = { left: '◀', right: '▶', brake: 'FREIO', grau: 'GRAU', helmet: 'CAPACETE' };

/** Página do Corredor SP: a base comum mais os gestos do jogo (escolha, teclado e botões de toque). */
export class CorredorPage extends BaseGamePage<CorredorE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'corredor-sp', logical: { w: 640, h: 400 }, hookName: '__e2e', soundOff: { [SOUND_KEY]: 'off' } });
  }

  get setupTitle(): Locator {
    return this.page.getByRole('heading', { name: 'CORREDOR SP' });
  }

  get startButton(): Locator {
    return this.page.getByRole('button', { name: 'Correr!' });
  }

  /** Abre o jogo na tela de escolha. */
  async open(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot(opts);
    await expect(this.setupTitle.or(this.page.locator('.hub-message, .corredor-sp .loading')).first()).toBeVisible();
  }

  trackButton(track: TrackId): Locator {
    const name = TRACKS.find((t) => t.id === track)!.name;
    return this.page.locator('.corredor-sp .card.track').filter({ hasText: name });
  }

  breedButton(breed: BreedId): Locator {
    return this.page.getByRole('button', { name: BREEDS.find((b) => b.id === breed)!.name, exact: true });
  }

  categoryButton(cat: CategoryId): Locator {
    const name = CATEGORIES.find((c) => c.id === cat)!.name;
    return this.page.locator('.corredor-sp .split-main .card').filter({ hasText: name });
  }

  modelButton(modelId: string): Locator {
    return this.page.locator('.corredor-sp .model').filter({ hasText: MODELS.find((m) => m.id === modelId)!.name });
  }

  colorButton(colorId: string): Locator {
    return this.page.getByRole('button', { name: COLORS.find((c) => c.id === colorId)!.name, exact: true });
  }

  /** Marca as escolhas pedidas na tela de escolha (cada clique vira evidência). */
  async choose(c: Partial<Choice>): Promise<void> {
    if (c.track) await this.trackButton(c.track).click();
    if (c.breed) await this.breedButton(c.breed).click();
    if (c.category) await this.categoryButton(c.category).click();
    if (c.modelId) await this.modelButton(c.modelId).click();
    if (c.colorId) await this.colorButton(c.colorId).click();
  }

  /** Clica em "Correr!" e espera o motor publicar o gancho (contagem começando). */
  async start(): Promise<void> {
    await this.startButton.click();
    await this.waitHook();
  }

  /** Abre, escolhe, larga e passa a contagem: devolve na corrida, moto parada. */
  async race(c: Partial<Choice> = {}, opts: BaseBootOptions & { calm?: boolean } = {}): Promise<void> {
    await this.open(opts);
    await this.choose(c);
    await this.start();
    // pré-condição: pista vazia e sem surgimentos, para o teste montar a situação que precisa
    if (opts.calm) await this.prepare((h) => h.prepare.calm(true));
    await this.frames(COUNTDOWN_FRAMES);
    await this.evidence('Contagem encerrada: turno em andamento');
  }

  state(): Promise<CorredorSnapshot> {
    return this.hook((h) => h.state());
  }

  /** Pré-condição rara via `prepare` (spec RN-15): todo uso é comentado no teste. */
  prepare<A = undefined>(fn: (h: CorredorE2E, arg: A) => unknown, arg?: A): Promise<unknown> {
    return this.hook(fn, arg);
  }

  /** Segura várias teclas juntas por `frames` quadros (ex.: ↑ e →). */
  async holdKeys(keys: string[], frames: number): Promise<void> {
    await this.ev.quiet(async () => {
      for (const k of keys) await this.page.keyboard.down(k);
      await this.frames(frames);
      for (const k of [...keys].reverse()) await this.page.keyboard.up(k);
    });
    await this.ev.action(`Segurar ${keys.join(' + ')} por ${frames} quadros (${+(frames / FPS).toFixed(2)} s) e soltar`);
  }

  accelerate(frames: number): Promise<void> {
    return this.holdKey('ArrowUp', frames);
  }

  brake(frames: number): Promise<void> {
    return this.holdKey('ArrowDown', frames);
  }

  steer(dir: 'left' | 'right', frames: number, accelerate = false): Promise<void> {
    const k = dir === 'left' ? 'ArrowLeft' : 'ArrowRight';
    return accelerate ? this.holdKeys(['ArrowUp', k], frames) : this.holdKey(k, frames);
  }

  grau(frames: number, accelerate = true): Promise<void> {
    return accelerate ? this.holdKeys(['ArrowUp', 'Space'], frames) : this.holdKey('Space', frames);
  }

  /** Arremessa um capacete (X). */
  helmet(key = 'x'): Promise<void> {
    return this.pressKey(key);
  }

  /** Leva a moto até a posição lateral `x` (tolerância `tol`), com setas em passos curtos; acelera junto se pedido. */
  async steerTo(x: number, opts: { accelerate?: boolean; tol?: number; maxFrames?: number } = {}): Promise<void> {
    const tol = opts.tol ?? 0.03;
    const max = opts.maxFrames ?? 600;
    let used = 0;
    await this.ev.quiet(async () => {
      const kb = this.page.keyboard;
      if (opts.accelerate) await kb.down('ArrowUp');
      for (;;) {
        const s = await this.state();
        const dx = x - s.player.x;
        if (Math.abs(dx) <= tol && Math.abs(s.player.vx) < 0.3) break;
        if (used >= max) throw new Error(`steerTo(${x}): moto em ${s.player.x.toFixed(3)} depois de ${max} quadros`);
        if (Math.abs(dx) <= tol) {
          await this.frames(2);
          used += 2;
          continue;
        }
        const k = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
        const n = Math.abs(dx) > 0.15 ? 4 : 1;
        await kb.down(k);
        await this.frames(n);
        await kb.up(k);
        used += n;
      }
      if (opts.accelerate) await kb.up('ArrowUp');
    });
    await this.ev.action(`Setas até a posição lateral ${x.toFixed(2)} (${used} quadros${opts.accelerate ? ', acelerando' : ''})`);
  }

  /**
   * Pilota segurando as teclas `keys` (padrão ↑) e corrigindo a posição lateral para `x` com toques de
   * ←/→ (a curva empurra a moto para fora), até `until` valer ou passar `frames` quadros. Uma evidência.
   */
  async drive(opts: { frames: number; x?: number; keys?: string[]; until?: (s: CorredorSnapshot) => boolean; chunk?: number; label?: string }): Promise<CorredorSnapshot> {
    const keys = opts.keys ?? ['ArrowUp'];
    const chunk = opts.chunk ?? 6;
    let used = 0;
    let s = await this.state();
    await this.ev.quiet(async () => {
      const kb = this.page.keyboard;
      for (const k of keys) await kb.down(k);
      while (used < opts.frames && !(opts.until && opts.until(s))) {
        const n = Math.min(chunk, opts.frames - used);
        const dx = opts.x === undefined ? 0 : opts.x - s.player.x;
        const fix = Math.abs(dx) > 0.02 && s.player.crashT <= 0 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null;
        if (fix) await kb.down(fix);
        await this.frames(fix ? 1 : n);
        if (fix) await kb.up(fix);
        if (fix && n > 1) await this.frames(n - 1);
        used += n;
        s = await this.state();
      }
      for (const k of [...keys].reverse()) await kb.up(k);
    });
    await this.ev.action(`${opts.label ?? `Pilotar com ${keys.join(' + ')}`} por ${used} quadros${opts.x === undefined ? '' : `, mantendo x ≈ ${opts.x.toFixed(2)}`}`);
    return s;
  }

  /** Botão de toque (abaixo da pista em ponteiro grosso). */
  touchButton(name: TouchName): Locator {
    return this.page.locator('.corredor-sp .tbtn').filter({ hasText: TOUCH_LABEL[name] });
  }

  /** Toque de dedo (eventos de toque reais, via CDP) num botão de toque, segurando `frames` quadros. */
  async touchBtn(name: TouchName, frames: number): Promise<void> {
    const r = (await this.hook((h, n) => h.targets().touch[n], name)) as { x: number; y: number; w: number; h: number } | null;
    if (!r) throw new Error(`botão de toque "${name}" sem tamanho na tela`);
    const point = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    await this.ev.quiet(async () => {
      const cdp = await this.page.context().newCDPSession(this.page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await this.frames(frames);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await this.frames(1);
      await cdp.detach();
    });
    await this.ev.action(`Toque no botão ${TOUCH_LABEL[name]} por ${frames} quadros (${+(frames / FPS).toFixed(2)} s)`);
  }

  /** Diálogo de pausa / fim de turno. */
  dialog(name: 'Pausa' | 'Fim de turno'): Locator {
    return this.page.getByRole('dialog', { name });
  }
}
