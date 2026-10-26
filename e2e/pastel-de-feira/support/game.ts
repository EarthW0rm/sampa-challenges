import type { Locator, Page } from '@playwright/test';
import type { E2EHook } from '../../../src/games/pastel-de-feira/game/e2eHook';
import type { StationId } from '../../../src/games/pastel-de-feira/game/types';
import type { Evidence } from '../../support/evidence';
import { expect, makeTest } from '../../support/fixtures';
import { BaseGamePage, FPS, expectSteps, type HookFn } from '../../support/game-page';
import { buildCampaign, SAVE_KEY, saveText, type CampaignSpec } from './campaign';
import { pastelDescriber } from './describe';

export { expect, expectSteps, FPS };
export type { EvidenceOptions } from '../../support/fixtures';

export const ROUTE = '#/jogos/pastel-de-feira';

export interface BootOptions {
  /** Campanha salva antes de abrir o jogo (fase `preparo` por padrão). `null` = sem save. */
  campaign?: CampaignSpec | null;
  phase?: 'preparo' | 'dia' | 'fim';
  /** Texto cru do save (para testar save corrompido). Tem prioridade sobre `campaign`. */
  rawSave?: string;
  /** Outras chaves do `localStorage`. */
  storage?: Record<string, string>;
  /** Semente do `Math.random` da página (sorteio da campanha nova). */
  randomSeed?: number;
  /** Bloqueia o `localStorage` (modo privado). */
  blockStorage?: boolean;
}

/**
 * Página do jogo com o relógio sob controle do teste (base comum: `e2e/support/game-page.ts`). O
 * `requestAnimationFrame` é trocado por uma fila manual: nada anda sozinho, e `frames(n)` roda `n`
 * quadros de exatamente 1/60 s (1 passo da simulação por quadro). O Pastel usa o relógio real de
 * `performance.now` (`virtualTime: false`) e o gancho `window.__pf`.
 */
export class GamePage extends BaseGamePage<E2EHook> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, {
      id: 'pastel-de-feira',
      ready: '.pastel-de-feira h1, .pastel-de-feira .prep',
      logical: { w: 640, h: 480 },
      hookName: '__pf',
      virtualTime: false,
      soundOff: { 'pastel-de-feira:som': 'off', 'pastel-de-feira:musica': 'off' },
    });
  }

  get clock(): Locator {
    return this.page.locator('.pastel-de-feira .hud-clock');
  }

  override async boot(opts: BootOptions = {}): Promise<void> {
    const save = opts.rawSave ?? (opts.campaign === null ? null : saveText(buildCampaign(opts.campaign ?? {}), opts.phase ?? 'preparo'));
    await super.boot({
      seed: opts.randomSeed ?? 1,
      storage: { ...(save !== null ? { [SAVE_KEY]: save } : {}), ...(opts.storage ?? {}) },
      blockStorage: opts.blockStorage,
      note: opts.phase ? `(save na fase ${opts.phase})` : undefined,
    });
  }

  /** Do título, com save em preparo: Continuar → Preparo. */
  async continueToPrep(): Promise<void> {
    if (await this.page.getByText('Progresso salvo inválido').isVisible()) throw new Error('fixture: o jogo recusou o save da campanha (save.ts, isCampaign)');
    await this.page.getByRole('button', { name: /^Continuar/ }).click();
    await expect(this.page.locator('.pastel-de-feira .prep')).toBeVisible();
  }

  /** No Preparo: Abrir a feira (aceita o aviso de falta, se aparecer) e espera o canvas e o gancho. */
  async openFair(): Promise<void> {
    await this.page.getByRole('button', { name: 'Abrir a feira' }).click();
    const anyway = this.page.getByRole('button', { name: 'Abrir mesmo assim' });
    if (await anyway.isVisible().catch(() => false)) await anyway.click();
    await this.waitForDay();
    await this.ev.milestone('Dia de feira aberto');
  }

  async waitForDay(): Promise<void> {
    await expect(this.canvas).toBeVisible();
    await this.page.waitForFunction(() => !!(window as unknown as { __pf?: unknown }).__pf);
    await this.frames(1);
  }

  /** Título → Preparo → Dia, com a campanha da fixture. */
  async startDay(opts: BootOptions = {}): Promise<void> {
    await this.boot(opts);
    await this.continueToPrep();
    await this.openFair();
  }

  /** Roda até o corte das 14h (o dia termina e a tela de fechamento aparece). */
  async runToEnd(): Promise<void> {
    for (let guard = 0; guard < 100; guard++) {
      const over = await this.page.evaluate(() => {
        const w = window as unknown as { __pf?: { sim: { isOver(): boolean } } | null };
        return !w.__pf || w.__pf.sim.isOver();
      });
      if (over) break;
      await this.frames(1200);
    }
    await expect(this.page.getByRole('heading', { name: 'Fim da feira' })).toBeVisible();
    await this.ev.milestone('Corte das 14h: tela de fechamento');
  }

  /** Passo atual da simulação. */
  tick(): Promise<number> {
    return this.hook((pf) => pf.sim.state.tick);
  }

  /** Avança `seconds` do relógio da simulação (conta passos, não quadros). */
  async advance(seconds: number): Promise<void> {
    const target = (await this.tick()) + Math.round(seconds * FPS);
    for (let guard = 0; guard < 200; guard++) {
      const t = await this.tick();
      if (t >= target || (await this.hook((pf) => pf.sim.isOver()))) return;
      await this.frames(target - t);
    }
    throw new Error('advance: a simulação não andou (pausada?)');
  }

  /** Avança até a condição valer ou estourar `maxSeconds` de jogo. */
  override async advanceUntil<A>(cond: HookFn<E2EHook, A, boolean>, maxSeconds: number, arg?: A, chunk = 6): Promise<void> {
    const limit = (await this.tick()) + maxSeconds * FPS;
    while (!(await this.hook(cond, arg))) {
      if ((await this.tick()) >= limit || (await this.hook((pf) => pf.sim.isOver()))) {
        throw new Error(`advanceUntil: condição não ocorreu em ${maxSeconds} s de jogo: ${cond.toString()}`);
      }
      await this.frames(chunk);
    }
  }

  async zone(id: string): Promise<{ x: number; y: number; w: number; h: number }> {
    const z = await this.hook((pf, zid) => {
      const r = pf.env.layout.byId.get(zid as never);
      return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
    }, id);
    if (!z) throw new Error(`zona ${id} não existe no layout`);
    return z;
  }

  /** Toca no centro da zona de uma estação (o pasteleiro começa a andar). */
  async tapStation(id: StationId): Promise<void> {
    await this.ev.quiet(() => this.tapZone(id));
    await this.ev.action(`Toque na estação ${id}`);
  }

  private async tapZone(id: StationId): Promise<void> {
    const z = await this.zone(id);
    // Zona coberta pelo painel aberto (mesas, expedição…): o jogador recolhe o painel antes (Esc), senão o toque cai num controle.
    const covered = await this.hook((pf, zz) => pf.env.ui.panel !== null && zz.y + zz.h > 300, z);
    if (covered) {
      await this.page.keyboard.press('Escape');
      await this.frames(1);
    }
    await this.tapAt(z.x + z.w / 2, z.y + Math.min(z.h - 6, z.h / 2));
  }

  /** Vai até a estação e espera chegar e o painel abrir. */
  async goTo(id: StationId): Promise<void> {
    await this.ev.quiet(async () => {
      await this.tapZone(id);
      await this.advanceUntil((pf, s) => pf.sim.state.pasteleiro.to === null && pf.sim.state.pasteleiro.at === s && pf.env.ui.panel === s, 5, id, 1);
    });
    await this.ev.action(`Ir até a estação ${id} (chegou e o painel abriu)`);
  }

  /** Controles do painel aberto. */
  controls(): ReturnType<E2EHook['controls']> extends infer R ? Promise<R> : never {
    return this.hook((pf) => pf.controls()) as never;
  }

  async findControl(label: string | RegExp, nth = 0): Promise<{ x: number; y: number; w: number; h: number; label: string; sub?: string }> {
    const all = await this.controls();
    const match = all.filter((c) => (typeof label === 'string' ? c.label === label : label.test(c.label)));
    const c = match[nth];
    if (!c) throw new Error(`controle ${String(label)} [${nth}] não está no painel: ${all.map((x) => x.label).join(', ')}`);
    return c;
  }

  /** Toca num controle do painel e roda 1 quadro (o comando entra no próximo passo). */
  async tapControl(label: string | RegExp, nth = 0): Promise<void> {
    const c = await this.findControl(label, nth);
    await this.ev.quiet(async () => {
      await this.tapAt(c.x + c.w / 2, c.y + c.h / 2);
      await this.frames(1);
    });
    await this.ev.action(`Toque no controle "${c.label}"${nth ? ` [${nth}]` : ''} do painel`);
  }

  /** Segura um controle do painel por `seconds` de jogo. */
  async holdControl(label: string | RegExp, seconds: number, nth = 0): Promise<void> {
    const c = await this.findControl(label, nth);
    await this.ev.quiet(async () => {
      await this.holdAt(c.x + c.w / 2, c.y + c.h / 2, seconds);
      await this.frames(1);
    });
    await this.ev.action(`Segurar o controle "${c.label}"${nth ? ` [${nth}]` : ''} do painel por ${+seconds.toFixed(2)} s e soltar`);
  }

  /** Espera um cliente chegar à fila (no máximo `maxSeconds` de jogo). */
  async waitCustomer(maxSeconds = 60): Promise<void> {
    await this.advanceUntil((pf) => pf.queue().length > 0, maxSeconds);
  }

  /** Toca no cliente `i` da fila (posição dos pés, um pouco acima). */
  async tapCustomer(i = 0): Promise<void> {
    const q = await this.hook((pf) => pf.queue());
    const c = q[i];
    if (!c) throw new Error(`não há cliente na posição ${i} da fila`);
    await this.ev.quiet(async () => {
      await this.tapAt(c.x, c.y - 20);
      await this.frames(1);
    });
    await this.ev.action(`Toque no cliente #${c.id} (posição ${i} da fila)`);
  }

}

/** Fixtures do Pastel: evidência a cada ação com o cabeçalho do dia e coleta de erros do console. */
export const test = makeTest((page, ev) => new GamePage(page, ev), [pastelDescriber]);

/** Pedido do primeiro cliente: itens pedidos, para os testes montarem o pastel certo. */
export function frontOrder(game: GamePage): Promise<{ id: number; profile: string; items: string[]; patience: number; patienceMax: number } | null> {
  return game.hook((pf) => {
    const c = pf.sim.state.customers.find((x) => x.place === 'fila');
    return c ? { id: c.id, profile: c.profile, items: c.lines.map((l) => l.item), patience: c.patience, patienceMax: c.patienceMax } : null;
  });
}
