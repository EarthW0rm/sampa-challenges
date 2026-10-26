import { expect, type Locator, type Page } from '@playwright/test';
import type { SinucaE2E, SinucaE2EPrepareTurn, SinucaE2EState } from '../../../src/games/sinuca-de-bar/game/e2eHook';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, type BaseBootOptions } from '../../support/game-page';

export type MenuOptions = {
  mode?: 'pvc' | 'pvp';
  rules?: 'lisas' | 'parimpar';
  level?: 1 | 2 | 3;
  names?: [string, string?];
  breaker?: 'p1' | 'p2' | 'random';
};

export type AimButton = 'left' | 'fineLeft' | 'fineRight' | 'right';

const AIM_LABELS: Record<AimButton, string> = {
  left: 'Girar a mira para a esquerda',
  fineLeft: 'Ajuste fino para a esquerda',
  fineRight: 'Ajuste fino para a direita',
  right: 'Girar a mira para a direita',
};

export const SOUND_KEY = 'sinuca-de-bar:som';
export const CONFIG_KEY = 'sinuca-de-bar:config';

/** Página da Sinuca de Bar: a base comum mais os gestos do jogo (menu, mira, força, tacada, branca). */
export class SinucaPage extends BaseGamePage<SinucaE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'sinuca-de-bar', logical: { w: 320, h: 200 }, hookName: '__e2e', soundOff: { [SOUND_KEY]: 'off' } });
  }

  private get rootEl(): Locator {
    return this.page.locator('.sinuca-de-bar');
  }

  /** Abre o jogo no menu. */
  async open(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot(opts);
    await expect(this.rootEl.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
  }

  /** Escolhe as opções do menu (só as dadas) e toca em Jogar. */
  async menu(o: MenuOptions = {}): Promise<void> {
    const pick = (name: string, value: string) => this.rootEl.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
    if (o.mode) await pick('mode', o.mode);
    if (o.rules) await pick('rules', o.rules);
    if (o.level) await pick('level', String(o.level));
    if (o.names) {
      const fields = this.rootEl.locator('.field input');
      await fields.nth(0).fill(o.names[0]);
      if (o.names[1] !== undefined) await fields.nth(1).fill(o.names[1]);
    }
    if (o.breaker) await pick('breaker', o.breaker);
    await this.rootEl.getByRole('button', { name: 'Jogar' }).click();
    await this.waitHook();
    await expect(this.canvas).toBeVisible();
    await this.frames(1);
    await this.evidence('Partida aberta');
  }

  /** Abre e começa uma partida. */
  async start(o: MenuOptions = {}, boot: BaseBootOptions = {}): Promise<void> {
    await this.open(boot);
    await this.menu(o);
  }

  state(): Promise<SinucaE2EState> {
    return this.hook((h) => h.state());
  }

  /** Mira tocando num ponto lógico da mesa. */
  aimAt(x: number, y: number): Promise<void> {
    return this.tapAt(x, y);
  }

  /** Botões ◀ ‹ › ▶, `n` toques. */
  async nudgeAim(button: AimButton, n = 1): Promise<void> {
    for (let i = 0; i < n; i++) await this.rootEl.getByRole('button', { name: AIM_LABELS[button] }).click();
  }

  get powerBar(): Locator {
    return this.rootEl.locator('input[type="range"]');
  }

  get shootButton(): Locator {
    return this.rootEl.getByRole('button', { name: 'Tacar!' });
  }

  /** Barra Força em `pct` (5–100). */
  async power(pct: number): Promise<void> {
    await this.powerBar.fill(String(pct));
  }

  /** Toca em Tacar!. */
  async shoot(): Promise<void> {
    await this.shootButton.click();
  }

  /** Avança até a tacada `before + 1` ser decidida (bolas paradas). */
  async settle(before: number, maxSeconds = 40): Promise<SinucaE2EState> {
    await this.advanceUntil((h, b) => h.state().shots > b, maxSeconds, before, 30);
    await this.evidence('Bolas paradas: tacada decidida');
    return this.state();
  }

  /** Tacar! e esperar as bolas pararem. */
  async shootAndSettle(): Promise<SinucaE2EState> {
    const before = (await this.state()).shots;
    await this.shoot();
    return this.settle(before);
  }

  /** Arrasta a branca até (x, y) lógico (bola na mão). */
  async placeCue(x: number, y: number, frames = 8): Promise<void> {
    const cue = (await this.state()).balls[0];
    await this.dragFromTo({ x: cue.x, y: cue.y }, { x, y }, frames);
  }

  /** Move a branca com W A S D (`n` toques, Shift = fino). */
  async placeCueKeys(key: 'w' | 'a' | 's' | 'd', n: number, fine = false): Promise<void> {
    const code = `${fine ? 'Shift+' : ''}Key${key.toUpperCase()}`;
    await this.ev.quiet(async () => {
      for (let i = 0; i < n; i++) await this.page.keyboard.press(code);
      await this.frames(1);
    });
    await this.ev.action(`Tecla ${code} ${n} vez(es): move a branca`);
  }

  /**
   * Pré-condição rara (spec RN-15): monta a mesa e a vez pelo `prepare` do gancho. Quem chama comenta o
   * porquê no teste.
   */
  async prepare(balls: { n: number; x: number; y: number }[], turn: 0 | 1, opts: SinucaE2EPrepareTurn = {}): Promise<void> {
    await this.hook(
      (h, a) => {
        h.prepare.balls(a.balls);
        h.prepare.turn(a.turn, a.opts);
      },
      { balls, turn, opts },
    );
    await this.frames(1);
    await this.evidence('Mesa preparada (pré-condição)');
  }

  /** Mira exata em direção a (x, y) lógico, tocando num ponto distante na mesma reta (menos erro de arredondamento). */
  async aimToward(x: number, y: number): Promise<void> {
    const cue = (await this.state()).balls[0];
    const a = Math.atan2(y - cue.y, x - cue.x);
    // ponto mais longe possível dentro do canvas na mesma direção
    let t = 1;
    for (let k = 1; k < 400; k++) {
      const px = cue.x + Math.cos(a) * k;
      const py = cue.y + Math.sin(a) * k;
      if (px < 1 || px > 319 || py < 1 || py > 199) break;
      t = k;
    }
    await this.aimAt(cue.x + Math.cos(a) * t, cue.y + Math.sin(a) * t);
  }
}
