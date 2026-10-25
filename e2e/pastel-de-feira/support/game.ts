import { test as base, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { E2EHook } from '../../../src/games/pastel-de-feira/game/e2eHook';
import type { StationId } from '../../../src/games/pastel-de-feira/game/types';
import { buildCampaign, SAVE_KEY, saveText, type CampaignSpec } from './campaign';
import { Evidence, evidenceLevel, wrapPage, type Composer, type EvidenceLevel } from './evidence';

export { expect };

export const ROUTE = '#/jogos/pastel-de-feira';
/** Quadros por segundo do relógio controlado: 1 quadro = 1 passo da simulação (1/60 s). */
export const FPS = 60;

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

type HookFn<A, R> = (pf: E2EHook, arg: A) => R;

/**
 * Página do jogo com o relógio sob controle do teste. O `requestAnimationFrame` é trocado por uma
 * fila manual: nada anda sozinho, e `frames(n)` roda `n` quadros de exatamente 1/60 s (1 passo da
 * simulação por quadro). O resto da página (React, imagens) segue normal.
 */
export class GamePage {
  /** `page` registra evidência a cada ação (ver `evidence.ts`); os gestos daqui registram uma só, já descrita. */
  constructor(
    readonly page: Page,
    readonly ev: Evidence,
  ) {}

  /** Registra uma evidência (captura com cabeçalho) do momento atual. */
  evidence(description: string): Promise<void> {
    return this.ev.milestone(description);
  }

  /** Passo nomeado: aparece no relatório e no cabeçalho das evidências tiradas dentro dele. */
  step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return this.ev.step(label, fn);
  }

  get canvas(): Locator {
    return this.page.locator('.pastel-de-feira canvas');
  }

  get clock(): Locator {
    return this.page.locator('.pastel-de-feira .hud-clock');
  }

  async boot(opts: BootOptions = {}): Promise<void> {
    const save = opts.rawSave ?? (opts.campaign === null ? null : saveText(buildCampaign(opts.campaign ?? {}), opts.phase ?? 'preparo'));
    await this.page.addInitScript(
      ({ key, save, storage, seed, block }) => {
        const w = window as unknown as Record<string, unknown>;
        w.__PF_E2E__ = true;
        // Math.random determinístico (mulberry32): a semente da campanha nova fica previsível.
        let a = seed >>> 0;
        Math.random = () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // Relógio manual dos quadros.
        const queue = new Map<number, FrameRequestCallback>();
        let nextId = 1;
        let ts = -1;
        window.requestAnimationFrame = (cb) => {
          queue.set(nextId, cb);
          return nextId++;
        };
        window.cancelAnimationFrame = (id) => {
          queue.delete(id);
        };
        w.__pfFrames = (n: number) => {
          if (ts < 0) ts = performance.now();
          for (let i = 0; i < n; i++) {
            ts += 1000 / 60;
            const cbs = [...queue.values()];
            queue.clear();
            for (const cb of cbs) cb(ts);
          }
        };
        // Salto do relógio sem quadros (aba em segundo plano): o próximo quadro chega com dt enorme.
        w.__pfJump = (ms: number) => {
          if (ts < 0) ts = performance.now();
          ts += ms;
        };
        // O storage só é preparado uma vez por teste (recarregar a página preserva o que o jogo gravou).
        if (block) {
          Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('bloqueado'); } });
        } else if (!sessionStorage.getItem('__pf_booted')) {
          sessionStorage.setItem('__pf_booted', '1');
          localStorage.clear();
          localStorage.setItem('pastel-de-feira:som', 'off');
          localStorage.setItem('pastel-de-feira:musica', 'off');
          if (save !== null) localStorage.setItem(key, save);
          for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
        }
      },
      { key: SAVE_KEY, save, storage: opts.storage ?? {}, seed: opts.randomSeed ?? 1, block: !!opts.blockStorage },
    );
    await this.page.goto(`./${ROUTE}`);
    await expect(this.page.locator('.pastel-de-feira h1, .pastel-de-feira .prep')).toBeVisible();
    await this.ev.milestone(`Jogo aberto em ${ROUTE}${opts.phase ? ` (save na fase ${opts.phase})` : ''}`);
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

  /** Roda uma função no navegador com o gancho do dia (precisa ser autocontida). */
  async hook<R, A = undefined>(fn: HookFn<A, R>, arg?: A): Promise<R> {
    return this.page.evaluate(
      ({ src, arg }) => {
        const pf = (window as unknown as { __pf?: unknown }).__pf;
        if (!pf) throw new Error('gancho __pf ausente (o dia não está aberto)');
        return (0, eval)(`(${src})`)(pf, arg);
      },
      { src: fn.toString(), arg: arg as unknown },
    ) as Promise<R>;
  }

  /** Como `hook`, mas com o gancho do último dia (vale depois do fechamento, quando a tela do dia já desmontou). */
  async lastHook<R, A = undefined>(fn: HookFn<A, R>, arg?: A): Promise<R> {
    return this.page.evaluate(
      ({ src, arg }) => {
        const pf = (window as unknown as { __pfLast?: unknown }).__pfLast;
        if (!pf) throw new Error('gancho __pfLast ausente (nenhum dia foi aberto)');
        return (0, eval)(`(${src})`)(pf, arg);
      },
      { src: fn.toString(), arg: arg as unknown },
    ) as Promise<R>;
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

  /** Roda `n` quadros de 1/60 s. */
  async frames(n: number): Promise<void> {
    for (let left = n; left > 0; left -= 600) {
      await this.page.evaluate((k) => (window as unknown as { __pfFrames: (k: number) => void }).__pfFrames(k), Math.min(600, left));
    }
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
  async advanceUntil<A>(cond: HookFn<A, boolean>, maxSeconds: number, arg?: A, chunk = 6): Promise<void> {
    const limit = (await this.tick()) + maxSeconds * FPS;
    while (!(await this.hook(cond, arg))) {
      if ((await this.tick()) >= limit || (await this.hook((pf) => pf.sim.isOver()))) {
        throw new Error(`advanceUntil: condição não ocorreu em ${maxSeconds} s de jogo: ${cond.toString()}`);
      }
      await this.frames(chunk);
    }
  }

  /** Pula `ms` de relógio sem rodar quadros (o próximo quadro chega atrasado). */
  async jump(ms: number): Promise<void> {
    await this.page.evaluate((k) => (window as unknown as { __pfJump: (k: number) => void }).__pfJump(k), ms);
  }

  /** Converte coordenadas lógicas (640×480) em coordenadas da página. */
  async toClient(x: number, y: number): Promise<{ x: number; y: number }> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('canvas sem caixa');
    return { x: box.x + (x * box.width) / 640, y: box.y + (y * box.height) / 480 };
  }

  /** Toque (botão abaixa e solta) num ponto lógico do canvas. */
  async tapAt(x: number, y: number): Promise<void> {
    const p = await this.toClient(x, y);
    await this.ev.quiet(async () => {
      await this.page.mouse.move(p.x, p.y);
      await this.page.mouse.down();
      await this.page.mouse.up();
    });
    await this.ev.action(`Toque no canvas em (${Math.round(x)}, ${Math.round(y)}) lógico`);
  }

  /** Segura o botão num ponto lógico por `seconds` de jogo e solta. */
  async holdAt(x: number, y: number, seconds: number): Promise<void> {
    const p = await this.toClient(x, y);
    await this.ev.quiet(async () => {
      await this.page.mouse.move(p.x, p.y);
      await this.page.mouse.down();
      await this.frames(Math.round(seconds * FPS));
      await this.page.mouse.up();
    });
    await this.ev.action(`Segurar o canvas em (${Math.round(x)}, ${Math.round(y)}) lógico por ${seconds} s e soltar`);
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

  /** Erros de página coletados (exceções não tratadas e console.error). */
  readonly errors: string[] = [];
}

export interface EvidenceOptions {
  /** Nível das evidências do projeto (`PF_EVIDENCIAS` tem prioridade). */
  evidencias: EvidenceLevel;
}

const evidenceOf = new WeakMap<Page, Evidence>();

/**
 * Fixtures: `page` registra evidência a cada ação e tira a captura final (resultado e erro);
 * `game` é a página com o gancho E2E e coleta de erros do console.
 */
export const test = base.extend<EvidenceOptions & { game: GamePage }, { composer: Composer }>({
  evidencias: ['acoes', { option: true }],
  // página que monta as evidências: contexto próprio, por worker (não mexe no foco da página do jogo), criada na primeira evidência
  composer: [
    async ({ browser }, use) => {
      let ctx: BrowserContext | null = null;
      let p: Promise<Page> | null = null;
      await use(() => {
        p ??= browser.newContext({ deviceScaleFactor: 1 }).then((c) => {
          ctx = c;
          return c.newPage();
        });
        return p;
      });
      await (ctx as BrowserContext | null)?.close();
    },
    { scope: 'worker' },
  ],
  page: async ({ page: raw, evidencias, composer }, use, testInfo) => {
    const ev = new Evidence(raw, testInfo, evidenceLevel(evidencias), composer);
    const page = wrapPage(raw, ev);
    evidenceOf.set(page, ev);
    await use(page);
    await ev.final();
  },
  game: async ({ page }, use) => {
    const g = new GamePage(page, evidenceOf.get(page)!);
    page.on('pageerror', (e) => g.errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') g.errors.push(`console: ${m.text()}`);
    });
    await use(g);
    expect(g.errors, 'erros no console da página').toEqual([]);
  },
});

/**
 * Passos esperados depois de N quadros. O carimbo de tempo dos quadros é ponto flutuante, então o
 * acumulador do laço pode ganhar ou perder 1 passo numa janela; a tolerância é de 1 passo.
 */
export function expectSteps(actual: number, expected: number, msg = 'passos da simulação'): void {
  expect(Math.abs(actual - expected), `${msg}: esperado ${expected}, obtido ${actual}`).toBeLessThanOrEqual(1);
}

/** Pedido do primeiro cliente: itens pedidos, para os testes montarem o pastel certo. */
export function frontOrder(game: GamePage): Promise<{ id: number; profile: string; items: string[]; patience: number; patienceMax: number } | null> {
  return game.hook((pf) => {
    const c = pf.sim.state.customers.find((x) => x.place === 'fila');
    return c ? { id: c.id, profile: c.profile, items: c.lines.map((l) => l.item), patience: c.patience, patienceMax: c.patienceMax } : null;
  });
}
