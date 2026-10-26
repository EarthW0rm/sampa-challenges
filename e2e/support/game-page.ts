/**
 * Página base de um jogo com o relógio sob controle do teste (plan.md 4.2). Cada jogo estende esta
 * classe em `e2e/<id>/support/page.ts` e só escreve os próprios gestos.
 *
 * Os gestos daqui registram uma evidência só, já descrita; as ações internas rodam em `ev.quiet`.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { installClock, type ClockWindow } from './clock';
import type { Evidence } from './evidence';

/** Quadros por segundo do relógio controlado. */
export const FPS = 60;

export interface GameConfig {
  /** Pasta do jogo em `src/games/` (e classe raiz do CSS). */
  id: string;
  /** Endereço aberto pelo `boot` (padrão `./#/jogos/<id>`). */
  path?: string;
  /** Seletor da raiz do jogo (padrão `.<id>`). */
  root?: string;
  /** Seletor que precisa estar visível para o jogo contar como aberto (padrão: a raiz). */
  ready?: string;
  /** Tamanho lógico do canvas (coordenadas usadas pelos testes e pelo jogo). */
  logical: { w: number; h: number };
  /** Global do gancho (`__e2e` nos jogos novos; `__pf` no Pastel). */
  hookName: string;
  /** `performance.now`/`Date.now` medidos em quadros (padrão `true`). */
  virtualTime?: boolean;
  /** Chaves de som/música e o valor "desligado" (spec RN-19). */
  soundOff?: Record<string, string>;
}

export interface BaseBootOptions {
  /** Semente do `Math.random` da página (padrão 1). */
  seed?: number;
  /** Chaves do `localStorage` (já serializadas). */
  storage?: Record<string, string>;
  /** Chaves gravadas como estão (dado corrompido). */
  rawStorage?: Record<string, string>;
  /** `localStorage` bloqueado (modo privado). */
  blockStorage?: boolean;
  /** Complemento do texto do marco "Jogo aberto". */
  note?: string;
}

export type HookFn<H, A, R> = (hook: H, arg: A) => R;

export class BaseGamePage<H = unknown> {
  /** Erros de página coletados (exceções não tratadas e console.error); a fixture falha o teste se houver. */
  readonly errors: string[] = [];
  readonly root: string;

  constructor(
    readonly page: Page,
    readonly ev: Evidence,
    readonly cfg: GameConfig,
  ) {
    this.root = cfg.root ?? `.${cfg.id}`;
  }

  get route(): string {
    return `#/jogos/${this.cfg.id}`;
  }

  get canvas(): Locator {
    return this.page.locator(`${this.root} canvas`).first();
  }

  /** Registra uma evidência (captura com cabeçalho) do momento atual. */
  evidence(description: string): Promise<void> {
    return this.ev.milestone(description);
  }

  /** Passo nomeado: aparece no relatório e no cabeçalho das evidências tiradas dentro dele. */
  step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    return this.ev.step(label, fn);
  }

  /** Injeta o relógio, abre o jogo e registra o marco "Jogo aberto". */
  async boot(opts: BaseBootOptions = {}): Promise<void> {
    await this.page.addInitScript(installClock, {
      seed: opts.seed ?? 1,
      virtualTime: this.cfg.virtualTime ?? true,
      storage: opts.storage ?? {},
      rawStorage: opts.rawStorage,
      blockStorage: !!opts.blockStorage,
      soundOff: this.cfg.soundOff ?? {},
    });
    const path = this.cfg.path ?? `./${this.route}`;
    await this.page.goto(path);
    await expect(this.page.locator(this.cfg.ready ?? this.root).first()).toBeVisible();
    await this.ev.milestone(`Jogo aberto em ${path.replace(/^\.\//, '')}${opts.note ? ` ${opts.note}` : ''}`);
  }

  /** Roda `n` quadros de 1/60 s. */
  async frames(n: number): Promise<void> {
    for (let left = n; left > 0; left -= 600) {
      await this.page.evaluate((k) => (window as unknown as ClockWindow).__e2eFrames(k), Math.min(600, left));
    }
  }

  /** Pula `ms` de relógio sem rodar quadros (o próximo quadro chega atrasado). */
  async jump(ms: number): Promise<void> {
    await this.page.evaluate((k) => (window as unknown as ClockWindow).__e2eJump(k), ms);
  }

  /** Pedidos de quadro na fila do relógio (laços vivos). */
  rafPending(): Promise<number> {
    return this.page.evaluate(() => (window as unknown as ClockWindow).__e2eRafPending());
  }

  /** O gancho do jogo está publicado? */
  hasHook(last = false): Promise<boolean> {
    return this.page.evaluate(
      ({ name }) => {
        const raw = (window as unknown as Record<string, unknown>)[name];
        return !!raw;
      },
      { name: this.cfg.hookName + (last ? 'Last' : '') },
    );
  }

  /** Espera o gancho aparecer (o jogo montou o motor). */
  async waitHook(): Promise<void> {
    // polling por tempo: o padrão (`raf`) nunca dispara com o relógio manual
    await this.page.waitForFunction((name) => !!(window as unknown as Record<string, unknown>)[name], this.cfg.hookName, { polling: 50 });
  }

  /** Roda uma função no navegador com o gancho (precisa ser autocontida). */
  hook<R, A = undefined>(fn: HookFn<H, A, R>, arg?: A): Promise<R> {
    return this.callHook(this.cfg.hookName, fn, arg);
  }

  /** Como `hook`, mas com o gancho da última montagem (vale depois que a tela desmontou). */
  lastHook<R, A = undefined>(fn: HookFn<H, A, R>, arg?: A): Promise<R> {
    return this.callHook(`${this.cfg.hookName}Last`, fn, arg);
  }

  private callHook<R, A>(name: string, fn: HookFn<H, A, R>, arg?: A): Promise<R> {
    return this.page.evaluate(
      ({ name, id, src, arg }) => {
        const raw = (window as unknown as Record<string, unknown>)[name] as { id?: string; api?: unknown } | null | undefined;
        if (!raw) throw new Error(`gancho ${name} ausente (${id})`);
        // Ganchos novos publicam `{ id, api }` (src/shared/e2e/hook.ts); o do Pastel é o objeto direto.
        const h = name.startsWith('__e2e') ? raw.api : raw;
        return (0, eval)(`(${src})`)(h, arg);
      },
      { name, id: this.cfg.id, src: fn.toString(), arg: arg as unknown },
    ) as Promise<R>;
  }

  /** Avança quadros até a condição valer ou estourar `maxSeconds` de jogo (em quadros). */
  async advanceUntil<A>(cond: HookFn<H, A, boolean>, maxSeconds: number, arg?: A, chunk = 6): Promise<void> {
    const limit = Math.ceil(maxSeconds * FPS);
    let done = 0;
    while (!(await this.hook(cond, arg))) {
      if (done >= limit) throw new Error(`advanceUntil: condição não ocorreu em ${maxSeconds} s de jogo: ${cond.toString()}`);
      await this.frames(chunk);
      done += chunk;
    }
  }

  /** Converte coordenadas lógicas em coordenadas da página. */
  async toClient(x: number, y: number): Promise<{ x: number; y: number }> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('canvas sem caixa');
    return { x: box.x + (x * box.width) / this.cfg.logical.w, y: box.y + (y * box.height) / this.cfg.logical.h };
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

  /** Arrasta de um ponto lógico a outro em `frames` quadros (um passo de mouse por quadro). */
  async dragFromTo(a: { x: number; y: number }, b: { x: number; y: number }, frames = 10): Promise<void> {
    const pa = await this.toClient(a.x, a.y);
    const pb = await this.toClient(b.x, b.y);
    const n = Math.max(1, frames);
    await this.ev.quiet(async () => {
      await this.page.mouse.move(pa.x, pa.y);
      await this.page.mouse.down();
      for (let i = 1; i <= n; i++) {
        await this.page.mouse.move(pa.x + ((pb.x - pa.x) * i) / n, pa.y + ((pb.y - pa.y) * i) / n);
        await this.frames(1);
      }
      await this.page.mouse.up();
    });
    await this.ev.action(`Arrastar de (${Math.round(a.x)}, ${Math.round(a.y)}) a (${Math.round(b.x)}, ${Math.round(b.y)}) lógico em ${n} quadros`);
  }

  /** Segura uma tecla por `frames` quadros exatos e solta. */
  async holdKey(key: string, frames: number): Promise<void> {
    await this.ev.quiet(async () => {
      await this.page.keyboard.down(key);
      await this.frames(frames);
      await this.page.keyboard.up(key);
    });
    await this.ev.action(`Segurar ${key} por ${frames} quadros (${+(frames / FPS).toFixed(2)} s) e soltar`);
  }

  /** Aperta e solta uma tecla e roda `frames` quadros (padrão 1: o jogo processa a tecla). */
  async pressKey(key: string, frames = 1): Promise<void> {
    await this.ev.quiet(async () => {
      await this.page.keyboard.press(key);
      if (frames > 0) await this.frames(frames);
    });
    await this.ev.action(`Tecla ${key}`);
  }
}

/**
 * Passos esperados depois de N quadros. O carimbo de tempo dos quadros é ponto flutuante, então o
 * acumulador do laço pode ganhar ou perder 1 passo numa janela; a tolerância é de 1 passo.
 */
export function expectSteps(actual: number, expected: number, msg = 'passos da simulação'): void {
  expect(Math.abs(actual - expected), `${msg}: esperado ${expected}, obtido ${actual}`).toBeLessThanOrEqual(1);
}
