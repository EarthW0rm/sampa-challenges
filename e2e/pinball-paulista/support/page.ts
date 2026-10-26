import { expect, type Page } from '@playwright/test';
import type { PinballE2E, PinballE2EState, PinballTargets } from '../../../src/games/pinball-paulista/game/e2eHook';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, FPS, type BaseBootOptions } from '../../support/game-page';

export type Side = 'esquerdo' | 'direito';

/** Página do Pinball Paulista: a base comum mais os gestos da mesa (lógico 240×400). */
export class PinballPage extends BaseGamePage<PinballE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'pinball-paulista', logical: { w: 240, h: 400 }, hookName: '__e2e', soundOff: { 'pinball-paulista:som': 'off' } });
  }

  /** Abre o jogo pelo hub, toca em **Jogar** e espera o gancho da mesa. */
  async open(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot({ seed: 1, ...opts });
    await this.page.getByRole('button', { name: 'Jogar' }).click();
    await this.waitHook();
    // 1 quadro: a mesa é desenhada (o relógio é manual)
    await this.ev.quiet(() => this.frames(1));
  }

  state(): Promise<PinballE2EState> {
    return this.hook((h) => h.state());
  }

  targets(): Promise<PinballTargets> {
    return this.hook((h) => h.targets());
  }

  /** Segura o flipper pelo teclado (Z / "/" ou as setas) por `frames` quadros. */
  async flipper(side: Side, frames: number, key?: string): Promise<void> {
    await this.holdKey(key ?? (side === 'esquerdo' ? 'z' : '/'), frames);
  }

  /** Abaixa a tecla de um flipper (sem soltar) e roda `frames` quadros. */
  async flipperDown(side: Side, frames = 1): Promise<void> {
    const key = side === 'esquerdo' ? 'z' : '/';
    await this.ev.quiet(async () => {
      await this.page.keyboard.down(key);
      await this.frames(frames);
    });
    await this.ev.action(`Abaixar ${key} (flipper ${side}) e segurar`);
  }

  async flipperUp(side: Side, frames = 1): Promise<void> {
    const key = side === 'esquerdo' ? 'z' : '/';
    await this.ev.quiet(async () => {
      await this.page.keyboard.up(key);
      await this.frames(frames);
    });
    await this.ev.action(`Soltar ${key} (flipper ${side})`);
  }

  /** Segura Espaço (ou outra tecla do lançador) por `seconds` de jogo e solta; roda 1 quadro depois. */
  async launch(seconds: number, key = 'Space'): Promise<void> {
    await this.holdKey(key, Math.round(seconds * FPS));
    await this.ev.quiet(() => this.frames(1));
  }

  /** Lança forte e espera a bola entrar na mesa (sair da rampa pelo portão). */
  async launchIntoPlay(): Promise<void> {
    await this.launch(1);
    await this.advanceUntil((h) => h.state().balls.some((b) => !b.rest && b.x < 210), 5);
  }

  /** Tecla N (tranco). */
  async nudge(frames = 1): Promise<void> {
    await this.pressKey('n', frames);
  }

  /** Segura a metade esquerda/direita da mesa com o mouse por `seconds`. */
  async touchFlipper(side: Side, seconds: number): Promise<void> {
    const t = await this.targets();
    const r = side === 'esquerdo' ? t.flipperLeft : t.flipperRight;
    await this.holdAt(r.x + r.w / 2, r.y + r.h / 2, seconds);
  }

  /** Segura o botão **Lançar** por `seconds` e solta. */
  async touchLaunch(seconds: number): Promise<void> {
    const btn = this.page.locator((await this.targets()).launch);
    const box = await btn.boundingBox();
    if (!box) throw new Error('botão Lançar sem caixa');
    await this.ev.quiet(async () => {
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.frames(Math.round(seconds * FPS));
      await this.page.mouse.up();
      await this.frames(1);
    });
    await this.ev.action(`Segurar o botão Lançar por ${seconds} s e soltar`);
  }

  /**
   * Toque real (pointerType touch, via CDP) segurado num ponto da página por `frames` quadros.
   * Só no projeto `celular` (hasTouch).
   */
  async touchHoldClient(x: number, y: number, frames: number, label: string): Promise<void> {
    const cdp = await this.page.context().newCDPSession(this.page);
    await this.ev.quiet(async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await this.frames(frames);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await this.frames(1);
    });
    await cdp.detach();
    await this.ev.action(`Toque segurado ${label} por ${frames} quadros`);
  }

  /** Toque segurado num ponto lógico da mesa. */
  async touchHoldAt(x: number, y: number, frames: number): Promise<void> {
    const p = await this.toClient(x, y);
    await this.touchHoldClient(p.x, p.y, frames, `na mesa em (${Math.round(x)}, ${Math.round(y)}) lógico`);
  }

  /** Pré-condição rara: coloca a bola em (x, y) com velocidade (vx, vy). Comente o uso no teste. */
  async placeBall(x: number, y: number, vx: number, vy: number, i = 0): Promise<void> {
    await this.hook((h, a) => h.prepare.ball(a.x, a.y, a.vx, a.vy, a.i), { x, y, vx, vy, i });
  }

  /** Pré-condição rara: luzes e contadores (`prepare.lights`). Comente o uso no teste. */
  async lights(o: Parameters<PinballE2E['prepare']['lights']>[0]): Promise<void> {
    await this.hook((h, a) => h.prepare.lights(a), o);
  }

  /** Pré-condição rara: leva a bola `i` para o ralo (entre os flippers, descendo). Comente o uso no teste. */
  async drainBall(i = 0): Promise<void> {
    await this.placeBall(111, 372, 0, 300, i);
  }

  /** Abaixa uma tecla (sem soltar) e roda `frames` quadros. */
  async keyDown(key: string, frames = 1): Promise<void> {
    await this.ev.quiet(async () => {
      await this.page.keyboard.down(key);
      await this.frames(frames);
    });
    await this.ev.action(`Abaixar ${key} e segurar (${frames} quadros)`);
  }

  /** Solta uma tecla e roda `frames` quadros. */
  async keyUp(key: string, frames = 1): Promise<void> {
    await this.ev.quiet(async () => {
      await this.page.keyboard.up(key);
      await this.frames(frames);
    });
    await this.ev.action(`Soltar ${key}`);
  }

  /** Placar exibido no painel "Pontos" (desktop) como número. */
  async shownScore(): Promise<number> {
    const t = (await this.page.locator(`${this.root} .side-right .score`).textContent()) ?? '';
    return Number(t.replace(/\D/g, ''));
  }

  /** Espera a fase do motor. */
  async waitPhase(phase: PinballE2EState['phase'], maxSeconds: number): Promise<void> {
    await this.advanceUntil((h, p) => h.state().phase === p, maxSeconds, phase);
  }

  async expectPhase(phase: PinballE2EState['phase']): Promise<void> {
    expect((await this.state()).phase).toBe(phase);
  }
}
