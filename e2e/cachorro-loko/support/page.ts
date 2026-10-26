import { expect, type Page } from '@playwright/test';
import { DOG_SPEED, DOG_TURBO_SPEED } from '../../../src/games/cachorro-loko/game/constants';
import type { CachorroLokoE2E, CLEvent, CLRect, CLState } from '../../../src/games/cachorro-loko/game/e2eHook';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, FPS, type BaseBootOptions } from '../../support/game-page';

export const RECORD_KEY = 'cachorro-loko:recorde';

export type Side = 'left' | 'right';

/** Página do Cachorro Loko: a base comum mais os gestos do jogo (andar, tocar, pausar). */
export class CachorroLokoPage extends BaseGamePage<CachorroLokoE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'cachorro-loko', logical: { w: 320, h: 200 }, hookName: '__e2e', soundOff: {} });
  }

  /** Abre o jogo no título (sem gancho ainda: o motor só existe na partida). */
  async openTitle(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot(opts);
    await expect(this.page.getByRole('heading', { name: 'CACHORRO LOKO' })).toBeVisible();
  }

  /** Título → partida com uma tecla (`Enter`/`Espaço`) ou clique em Jogar; espera o motor. */
  async start(how: 'Enter' | 'Space' | 'click' = 'Enter'): Promise<void> {
    if (how === 'click') await this.page.getByRole('button', { name: 'Jogar' }).click();
    else await this.pressKey(how, 0);
    await this.waitHook();
    await this.ev.milestone('Partida iniciada');
  }

  /** Abre e começa a partida. */
  async play(opts: BaseBootOptions = {}): Promise<void> {
    await this.openTitle(opts);
    await this.start();
  }

  state(): Promise<CLState> {
    return this.hook((h) => h.state());
  }

  events(from = 0): Promise<CLEvent[]> {
    return this.hook((h, f) => h.events(f), from);
  }

  /** Segura uma tecla de direção por `frames` quadros. */
  walk(dir: Side, frames: number, keys: 'setas' | 'ad' = 'setas'): Promise<void> {
    const key = keys === 'setas' ? (dir === 'left' ? 'ArrowLeft' : 'ArrowRight') : dir === 'left' ? 'KeyA' : 'KeyD';
    return this.holdKey(key, frames);
  }

  /** Quadros para andar `dx` px lógicos (com ou sem turbo). */
  static framesFor(dx: number, turbo = false): number {
    return Math.round(Math.abs(dx) / ((turbo ? DOG_TURBO_SPEED : DOG_SPEED) / FPS));
  }

  /** Anda até o canto esquerdo do cachorro ficar em ≈ `x` (erro ≤ meio passo de um quadro). */
  async walkTo(x: number): Promise<void> {
    const s = await this.state();
    const dx = x - s.dog.x;
    const n = CachorroLokoPage.framesFor(dx, s.powers.turbo > 0);
    if (n > 0) await this.walk(dx < 0 ? 'left' : 'right', n);
  }

  /** Zonas de toque (coordenadas da página). */
  async zone(side: Side): Promise<CLRect> {
    const t = await this.hook((h) => h.targets());
    const r = side === 'left' ? t.left : t.right;
    if (!r) throw new Error(`zona de toque ${side} ausente`);
    return r;
  }

  /**
   * Segura a zona de toque de um lado por `frames` quadros e solta. Em tela de toque usa toque de
   * verdade (CDP), senão o mouse (que também aciona as zonas).
   */
  async touch(side: Side, frames: number): Promise<void> {
    const r = await this.zone(side);
    const p = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const coarse = await this.page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    await this.ev.quiet(async () => {
      if (coarse) {
        const cdp = await this.page.context().newCDPSession(this.page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
        await this.frames(frames);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await this.page.mouse.move(p.x, p.y);
        await this.page.mouse.down();
        await this.frames(frames);
        await this.page.mouse.up();
      }
    });
    await this.ev.action(`${coarse ? 'Toque' : 'Mouse'} segurando a zona ${side === 'left' ? 'esquerda' : 'direita'} por ${frames} quadros e soltando`);
  }

  /** Pausa/continua pelo teclado. */
  pause(key: 'KeyP' | 'Escape' = 'KeyP'): Promise<void> {
    return this.pressKey(key, 1);
  }

  /** A janela perde o foco (troca de aba ou de programa). */
  async blurWindow(): Promise<void> {
    await this.ev.quiet(() => this.page.evaluate(() => window.dispatchEvent(new Event('blur'))));
    await this.ev.action('Janela perde o foco (evento blur)');
  }

  /** Espera o diálogo de fim de turno (atraso de 1,2 s em relógio real). */
  async waitGameOver(): Promise<void> {
    await expect(this.page.getByRole('dialog', { name: 'Fim de jogo' })).toBeVisible();
    await this.ev.milestone('Fim do turno');
  }
}
