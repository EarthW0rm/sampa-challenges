import { expect, type Locator, type Page } from '@playwright/test';
import type { FugaE2E, FugaState, FugaTargets } from '../../../src/games/fuga-rocam/game/e2eHook';
import { MAPS } from '../../../src/games/fuga-rocam/game/maps';
import type { MapId } from '../../../src/games/fuga-rocam/game/types';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, type BaseBootOptions } from '../../support/game-page';
import { costField, DIR_KEYS, DIR_NAMES, routeStep, tileCenter, type DirKey, type Tile } from './route';

export const SOUND_KEY = 'fuga-rocam:som';
export const recordKey = (m: MapId): string => `fuga-rocam:recorde:${m}`;

export interface GoOptions {
  /** Segura o turbo (Espaço) durante o trajeto. */
  turbo?: boolean;
  /** Para antes, quando a condição (lida do estado) valer. */
  until?: (s: FugaState) => boolean;
  /** Teto de quadros do trajeto (padrão 60 s de jogo). */
  maxFrames?: number;
  /** Desvia das viaturas (custo extra nos tiles perto delas, recalculado a cada decisão). */
  avoidCops?: boolean;
  /** Não passa pelos tiles com item (para não pegá-los). */
  avoidItems?: boolean;
  /** Quadros por decisão quando há `until` (padrão 6). */
  step?: number;
  /** Chamado com cada estado lido no trajeto (antes de decidir). */
  trace?: (s: FugaState) => void;
}

/** Custo extra dos tiles perto das viaturas ativas (rota que desvia). */
export function copPenalty(s: FugaState): ((tx: number, ty: number) => number) | undefined {
  const cops = s.copList.filter((c) => !c.leaving && c.stun <= 0);
  if (!cops.length) return undefined;
  return (tx, ty) => {
    let p = 0;
    for (const c of cops) {
      const d = Math.abs(c.tx - tx) + Math.abs(c.ty - ty);
      if (d <= 1) p += 60;
      else if (d <= 3) p += 20;
      else if (d <= 5) p += 4;
    }
    return p;
  };
}

/** Página da Fuga da Rocam: a base comum mais os gestos do jogo (lógico 640×400). */
export class FugaPage extends BaseGamePage<FugaE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'fuga-rocam', logical: { w: 640, h: 400 }, hookName: '__e2e', soundOff: { [SOUND_KEY]: 'off' } });
  }

  /**
   * Espera o gancho com polling por tempo: o `waitHook` da base usa o polling padrão (`raf`), que nunca
   * dispara com o relógio manual quando o gancho não está pronto na primeira checagem.
   */
  override async waitHook(): Promise<void> {
    await this.page.waitForFunction(() => !!(window as unknown as { __e2e?: unknown }).__e2e, undefined, { polling: 50 });
  }

  /** Abre o jogo pelo hub e espera a tela de título. */
  async open(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot({ seed: 1, ...opts });
    await expect(this.page.getByRole('heading', { name: 'FUGA DA ROCAM' })).toBeVisible();
  }

  mapCard(id: MapId): Locator {
    const i = MAPS.findIndex((m) => m.id === id);
    return this.page.locator('.fuga-rocam .map-card').nth(i);
  }

  /** Escolhe o mapa pelo card (clique) ou pela tecla do número; espera o gancho do motor. */
  async chooseMap(id: MapId, via: 'clique' | 'tecla' = 'clique'): Promise<void> {
    const i = MAPS.findIndex((m) => m.id === id);
    await this.ev.quiet(async () => {
      if (via === 'clique') await this.mapCard(id).click();
      else await this.page.keyboard.press(String(i + 1));
      await this.waitHook();
      await this.frames(1); // desenha o mapa (PRONTO não anda)
    });
    await this.ev.action(via === 'clique' ? `Clique no card "${MAPS[i].name}"` : `Tecla ${i + 1}: mapa "${MAPS[i].name}"`);
  }

  /** Abre e já entra no mapa (PRONTO). */
  async start(id: MapId = 'centro', opts: BaseBootOptions = {}): Promise<void> {
    await this.open(opts);
    await this.chooseMap(id);
  }

  state(): Promise<FugaState> {
    return this.hook((h) => h.state());
  }

  targets(): Promise<FugaTargets> {
    return this.hook((h) => h.targets());
  }

  /** Seta (ou WASD) para uma direção. */
  turn(key: DirKey | 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD', frames = 1): Promise<void> {
    return this.pressKey(key, frames);
  }

  /** Turbo (Espaço) segurado por `frames` quadros. */
  turbo(frames: number, key: 'Space' | 'ShiftLeft' | 'ShiftRight' = 'Space'): Promise<void> {
    return this.holdKey(key, frames);
  }

  /** Solta óleo (X). */
  oil(key: 'KeyX' | 'KeyZ' | 'KeyE' = 'KeyX'): Promise<void> {
    return this.pressKey(key);
  }

  /** Toque num botão do direcional (▲ ◀ ▶ ▼). */
  async dpad(dir: 0 | 1 | 2 | 3, frames = 1): Promise<void> {
    const label = ['Direita', 'Baixo', 'Esquerda', 'Cima'][dir];
    await this.ev.quiet(async () => {
      await this.page.getByRole('button', { name: label, exact: true }).tap();
      await this.frames(frames);
    });
    await this.ev.action(`Toque no direcional: ${label}`);
  }

  /** Desliza o dedo no mapa (eventos de toque reais via CDP), do centro do canvas `dist` px de tela. */
  async swipe(dir: 0 | 1 | 2 | 3, dist = 60): Promise<void> {
    const box = (await this.canvas.boundingBox())!;
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height / 2;
    const dx = [1, 0, -1, 0][dir] * dist;
    const dy = [0, 1, 0, -1][dir] * dist;
    await this.ev.quiet(async () => {
      const cdp = await this.page.context().newCDPSession(this.page);
      const pt = (x: number, y: number) => [{ x, y, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
      for (let i = 1; i <= 4; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (dx * i) / 4, y0 + (dy * i) / 4) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await this.frames(1);
    });
    await this.ev.action(`Deslizar ${dist} px para ${DIR_NAMES[dir]} no mapa`);
  }

  /**
   * Dirige até o centro do tile (tx, ty) apertando a seta certa em cada esquina (rota do `route.ts`).
   * Para ao chegar, quando `until` valer, ou se a fase sair de PRONTO/jogando. Devolve o estado final.
   */
  async goToTile(tx: number, ty: number, opts: GoOptions = {}): Promise<FugaState> {
    const target: Tile = [tx, ty];
    const max = opts.maxFrames ?? 3600;
    let s = await this.state();
    let field = costField(s.map, target);
    const c = tileCenter(target);
    let used = 0;
    await this.ev.quiet(async () => {
      if (opts.turbo) await this.page.keyboard.down('Space');
      try {
        for (;;) {
          opts.trace?.(s);
          if (opts.until?.(s)) return;
          if (s.phase !== 'play' && s.phase !== 'ready') return;
          if (Math.hypot(s.player.x - c.x, s.player.y - c.y) <= 2.5) return;
          if (used >= max) throw new Error(`goToTile(${tx}, ${ty}): não chegou em ${max} quadros (em ${s.player.tx}, ${s.player.ty})`);
          if (opts.avoidCops || opts.avoidItems) {
            const cop = opts.avoidCops ? copPenalty(s) : undefined;
            const items = opts.avoidItems ? new Set(s.itemList.map((i) => `${i.tx},${i.ty}`)) : null;
            field = costField(s.map, target, (tx, ty) => (cop ? cop(tx, ty) : 0) + (items?.has(`${tx},${ty}`) ? 500 : 0));
          }
          const heavy = s.job?.stage === 'drop' && s.job.kind === 'pesado';
          const step = routeStep(s.map, field, target, s.player, s.want, { turbo: opts.turbo, heavy });
          if (step.key) await this.page.keyboard.press(step.key);
          const n = Math.min(step.frames, opts.until ? (opts.step ?? 6) : step.frames);
          await this.frames(n);
          used += n;
          s = await this.state();
        }
      } finally {
        if (opts.turbo) await this.page.keyboard.up('Space');
      }
    });
    await this.ev.action(`Dirigir${opts.turbo ? ' com turbo' : ''} até o tile (${tx}, ${ty}) pelas setas (${used} quadros)`);
    return s;
  }

  /** Espera o PEGO! acabar (fase volta a PRONTO ou fim de jogo). */
  async waitCaught(): Promise<FugaState> {
    let s = await this.state();
    while (s.phase === 'caught') {
      await this.frames(10);
      s = await this.state();
    }
    return s;
  }

  /**
   * Busca o pedido atual (`stage: 'pickup'`) pelas setas, desviando das viaturas; atravessa capturas.
   * Para com o pedido coletado, quando `until` valer ou no fim de jogo.
   */
  async pickup(opts: GoOptions = {}): Promise<FugaState> {
    return this.leg('pickup', opts);
  }

  /** Leva o pedido coletado até o pino verde; para no quadro em que `near` vale (a até 24 px) se pedido. */
  async drop(opts: GoOptions = {}): Promise<FugaState> {
    return this.leg('drop', opts);
  }

  private async leg(stage: 'pickup' | 'drop', opts: GoOptions): Promise<FugaState> {
    let s = await this.state();
    const d0 = s.deliveries;
    const done = (x: FugaState) => (stage === 'pickup' ? x.job?.stage !== 'pickup' : x.deliveries > d0 || !x.job) || !!opts.until?.(x);
    for (let tries = 0; tries < 8 && !done(s) && s.phase !== 'over'; tries++) {
      if (s.phase === 'caught') s = await this.waitCaught();
      if (s.phase === 'paused' || s.phase === 'over' || !s.job) break;
      const t = stage === 'pickup' ? s.job.pickup : s.job.drop;
      s = await this.goToTile(t[0], t[1], { avoidCops: true, ...opts, until: done });
    }
    return s;
  }

  /** Busca e entrega o pedido atual pelas setas. */
  async deliver(opts: GoOptions = {}): Promise<FugaState> {
    const s = await this.pickup(opts);
    if (s.job?.stage !== 'drop') return s;
    return this.drop(opts);
  }

  /** Espera o próximo pedido chegar (jogando). */
  async waitJob(): Promise<FugaState> {
    await this.advanceUntil((h) => !!h.state().job || h.state().phase !== 'play', 5, undefined, 6);
    return this.state();
  }

  /** Setas sem efeito de rota: nome legível. */
  static keyName(k: DirKey): string {
    return DIR_NAMES[DIR_KEYS.indexOf(k)];
  }
}
