/**
 * Evidências dos testes: cada ação (clique, tecla, toque no canvas) e cada marco do teste vira um PNG
 * em `evidencias/<projeto>/<arquivo>/<teste>/`, com um cabeçalho que diz qual teste é, qual ação
 * acabou de ser feita, em que contexto (passo do fluxo) e o que a tela mostrava naquele instante.
 *
 * Níveis (`PF_EVIDENCIAS` ou a opção `evidencias` do projeto):
 * - `acoes`: marcos + toda ação (padrão);
 * - `marcos`: abertura do jogo, início e fim do dia, fim do teste e chamadas explícitas a `game.evidence()`;
 * - `off`: nada.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type Keyboard, type Locator, type Mouse, type Page, type TestInfo } from '@playwright/test';

export type EvidenceLevel = 'acoes' | 'marcos' | 'off';

/** Pasta raiz das evidências (fora do controle de versão). */
export const EVIDENCE_DIR = fileURLToPath(new URL('../../../evidencias/', import.meta.url));
const TEST_DIR = fileURLToPath(new URL('../../', import.meta.url));

const LEVELS: readonly EvidenceLevel[] = ['acoes', 'marcos', 'off'];

export function evidenceLevel(option: EvidenceLevel): EvidenceLevel {
  const env = process.env.PF_EVIDENCIAS as EvidenceLevel | undefined;
  return env && LEVELS.includes(env) ? env : option;
}

const slug = (s: string, max = 60): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
    .replace(/-$/, '') || 'x';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

type Details = [string, string][];

/** Lê da página o que a tela mostra (tela, HUD, estado do dia). Roda no navegador: precisa ser autocontida. */
function describeScreen(page: Page): Promise<Details> {
  return page.evaluate(() => {
    const out: [string, string][] = [];
    const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: Element): boolean => (el as HTMLElement).offsetParent !== null || (el as HTMLElement).getClientRects().length > 0;
    out.push(['Rota', location.hash || '#/']);
    const root = document.querySelector('.pastel-de-feira');
    const dialogs = [...document.querySelectorAll('[role=dialog]')].filter(shown).map((d) => d.getAttribute('aria-label') || text(d).slice(0, 80));
    if (!root) out.push(['Tela', 'Hub (fora do jogo)']);
    else if (root.querySelector('.day')) {
      out.push(['Tela', 'Dia de feira']);
      const hud = [...root.querySelectorAll('.hud > span')].map(text).filter(Boolean);
      if (hud.length) out.push(['HUD', hud.join('  ·  ')]);
    } else if (root.querySelector('.prep')) {
      const tab = root.querySelector('[role=tab][aria-selected=true]');
      out.push(['Tela', `Preparo${tab ? ` — aba ${text(tab)}` : ''}`]);
    } else {
      const h = [...root.querySelectorAll('h1, h2')].filter(shown).map(text).filter(Boolean);
      out.push(['Tela', h[0] ?? '(sem título)']);
    }
    if (dialogs.length) out.push(['Diálogo', dialogs.join(' | ')]);
    const status = [...document.querySelectorAll('[role=status], [role=alert]')].filter(shown).map(text).filter(Boolean);
    if (status.length) out.push(['Mensagem', status.join(' | ').slice(0, 200)]);

    type Hook = {
      sim: { state: { tick: number; paused: boolean; pasteleiro: { at: string; to: string | null }; customers: { place: string }[]; ready: unknown[]; cups: unknown[] } };
      env: { ui: { panel: string | null; selected: { kind: string; id: number } | null } };
      controls: () => { label: string }[];
    };
    const pf = (window as unknown as { __pf?: Hook | null }).__pf;
    if (pf) {
      const st = pf.sim.state;
      const s = Math.floor(st.tick / 60);
      out.push(['Simulação', `passo ${st.tick} (${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}s de jogo)${st.paused ? ' — PAUSADO' : ''}`]);
      out.push(['Pasteleiro', st.pasteleiro.to ? `${st.pasteleiro.at} → ${st.pasteleiro.to}` : `em ${st.pasteleiro.at}`]);
      const ui = pf.env.ui;
      out.push(['Painel', ui.panel ? `${ui.panel}: ${pf.controls().map((c) => c.label).join(', ').slice(0, 160)}` : 'recolhido']);
      if (ui.selected) out.push(['Selecionado', `${ui.selected.kind} #${ui.selected.id}`]);
      const places = new Map<string, number>();
      for (const c of st.customers) places.set(c.place, (places.get(c.place) ?? 0) + 1);
      out.push(['Clientes', st.customers.length ? [...places].map(([p, n]) => `${n} ${p}`).join(', ') : 'nenhum']);
      out.push(['Prontos', `${st.ready.length} pastel(éis), ${st.cups.length} copo(s)`]);
    }
    return out;
  });
}

/** Página auxiliar (contexto separado, por worker) que monta o PNG final: cabeçalho + captura. */
export type Composer = () => Promise<Page>;

export class Evidence {
  private n = 0;
  private quietDepth = 0;
  private readonly context: string[] = [];
  private readonly dir: string;

  constructor(
    private readonly page: Page,
    private readonly info: TestInfo,
    readonly level: EvidenceLevel,
    private readonly composer: Composer,
  ) {
    const file = relative(TEST_DIR, info.file).replace(/\.spec\.ts$/, '');
    const name = slug(info.title, 80) + (info.retry ? `-retry${info.retry}` : '') + (info.repeatEachIndex ? `-rep${info.repeatEachIndex}` : '');
    this.dir = `${EVIDENCE_DIR}${info.project.name}/${file}/${name}/`;
    if (level !== 'off') {
      rmSync(this.dir, { recursive: true, force: true });
      mkdirSync(this.dir, { recursive: true });
    }
  }

  /** Roda `fn` sem registrar as ações internas (o chamador registra uma só, já descrita). */
  async quiet<T>(fn: () => Promise<T>): Promise<T> {
    this.quietDepth++;
    try {
      return await fn();
    } finally {
      this.quietDepth--;
    }
  }

  /** Passo nomeado do fluxo: aparece no relatório (`test.step`) e no cabeçalho das evidências de dentro. */
  async step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.context.push(label);
    try {
      return await test.step(label, fn, { box: true });
    } finally {
      this.context.pop();
    }
  }

  /** Ação do teste (clique, tecla, toque): só no nível `acoes` e fora de `quiet`. */
  async action(description: string): Promise<void> {
    if (this.level === 'acoes' && this.quietDepth === 0) await this.capture('Ação', description);
  }

  /** Marco do teste (tela aberta, dia iniciado, fechamento): níveis `acoes` e `marcos`. */
  async milestone(description: string): Promise<void> {
    if (this.level !== 'off') await this.capture('Marco', description);
  }

  /** Estado final do teste, com o resultado e o erro (se houver). */
  async final(): Promise<void> {
    if (this.level === 'off' || this.page.isClosed()) return;
    const status = this.info.status ?? 'passed';
    const ok = status === this.info.expectedStatus;
    const error = this.info.error?.message ? stripAnsi(this.info.error.message).slice(0, 1200) : undefined;
    await this.capture(ok ? 'Fim' : 'Falha', `Teste terminou: ${STATUS[status] ?? status}`, { ok, error });
  }

  private async capture(kind: string, description: string, end?: { ok: boolean; error?: string }): Promise<void> {
    const n = ++this.n;
    try {
      const shot = await this.page.screenshot({ timeout: 5_000, caret: 'initial' });
      const details = await describeScreen(this.page).catch((e: Error): Details => [['Tela', `(não foi possível ler: ${e.message.split('\n')[0]})`]]);
      const html = this.caption(n, kind, description, details, shot, end);
      const composer = await this.composer();
      await composer.setViewportSize({ width: 1280, height: 400 });
      await composer.setContent(html, { waitUntil: 'load' });
      const png = await composer.screenshot({ fullPage: true });
      writeFileSync(`${this.dir}${String(n).padStart(3, '0')}-${slug(kind, 10)}-${slug(description)}.png`, png);
    } catch (e) {
      // evidência nunca derruba o teste
      console.warn(`[evidência ${n}] ${(e as Error).message.split('\n')[0]}`);
    }
  }

  private caption(n: number, kind: string, description: string, details: Details, shot: Buffer, end?: { ok: boolean; error?: string }): string {
    const color = kind === 'Falha' ? '#c62828' : kind === 'Fim' ? '#2e7d32' : kind === 'Marco' ? '#1565c0' : '#6d4c41';
    const titlePath = this.info.titlePath.slice(1).join(' › ');
    const rows = details.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    const ctx = this.context.length ? `<div class="ctx">Passo do fluxo: ${esc(this.context.join(' › '))}</div>` : '';
    const err = end?.error ? `<pre class="err">${esc(end.error)}</pre>` : '';
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; background: #fff; font: 14px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif; color: #212121; }
      header { padding: 12px 16px; border-left: 8px solid ${color}; background: #fafafa; border-bottom: 1px solid #ddd; }
      .test { font-size: 15px; font-weight: 600; }
      .meta { color: #616161; font-size: 12px; margin-top: 2px; }
      .act { margin-top: 8px; font-size: 18px; }
      .kind { display: inline-block; background: ${color}; color: #fff; border-radius: 4px; padding: 1px 8px; margin-right: 8px; font-size: 13px; font-weight: 600; vertical-align: 2px; }
      .ctx { margin-top: 4px; color: #424242; }
      table { margin-top: 8px; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 1px 12px 1px 0; color: #616161; font-weight: 500; white-space: nowrap; vertical-align: top; }
      td { padding: 1px 0; }
      .err { margin: 8px 0 0; padding: 8px; background: #ffebee; color: #b71c1c; white-space: pre-wrap; font-size: 12px; }
      img { display: block; max-width: 100%; image-rendering: pixelated; }
    </style></head><body>
      <header>
        <div class="test">${esc(titlePath)}</div>
        <div class="meta">${esc(relative(TEST_DIR, this.info.file))} · projeto ${esc(this.info.project.name)} · evidência ${n} · ${new Date().toLocaleString('pt-BR')}</div>
        <div class="act"><span class="kind">${esc(kind)}</span>${esc(description)}</div>
        ${ctx}
        <table>${rows}</table>
        ${err}
      </header>
      <img src="data:image/png;base64,${shot.toString('base64')}">
    </body></html>`;
  }
}

const STATUS: Record<string, string> = { passed: 'passou', failed: 'falhou', timedOut: 'estourou o tempo', skipped: 'pulado', interrupted: 'interrompido' };

/** Ações de `Locator` que viram evidência. */
const LOCATOR_ACTIONS: Record<string, string> = {
  click: 'Clique em',
  dblclick: 'Duplo clique em',
  tap: 'Toque em',
  fill: 'Preencher',
  clear: 'Limpar',
  press: 'Tecla',
  pressSequentially: 'Digitar em',
  type: 'Digitar em',
  check: 'Marcar',
  uncheck: 'Desmarcar',
  setChecked: 'Marcar/desmarcar',
  selectOption: 'Escolher opção em',
  dragTo: 'Arrastar',
};

const isLocator = (v: unknown): v is Locator =>
  !!v && typeof v === 'object' && typeof (v as Locator).click === 'function' && typeof (v as Locator).boundingBox === 'function' && typeof (v as Locator).evaluate === 'function';

/** Só métodos públicos: `constructor`, símbolos e internos (`_x`) ficam intactos (o `expect` do Playwright depende deles). */
const wrappable = (prop: string | symbol): boolean => typeof prop === 'string' && prop !== 'constructor' && !prop.startsWith('_');

const argText = (args: unknown[]): string =>
  args
    .filter((a) => typeof a === 'string' || typeof a === 'number' || Array.isArray(a))
    .map((a) => JSON.stringify(a))
    .join(', ');

const ROLES: Record<string, string> = { button: 'botão', tab: 'aba', heading: 'título', checkbox: 'caixa', link: 'link', dialog: 'diálogo', textbox: 'campo' };

/** `getByRole('button', { name: 'Abrir a feira' })` → `botão "Abrir a feira"`; o resto fica como o Playwright descreve. */
const describeLocator = (loc: Locator): string =>
  loc
    .toString()
    .replace(/getByRole\('(\w+)', \{ name: (?:'([^']*)'|\/([^/]*)\/\w*)(?:, exact: true)? \}\)/g, (_, role: string, name?: string, re?: string) => `${ROLES[role] ?? role} "${name ?? re!.replace(/^\^|\$$/g, '')}"`)
    .replace(/getByText\('([^']*)'(?:, \{ exact: true \})?\)/g, 'texto "$1"')
    .replace(/getByText\(\/([^/]*)\/\w*\)/g, 'texto "$1"')
    .replace(/\.filter\(\{ hasText: '([^']*)' \}\)/g, ' com "$1"')
    .replace(/\.(botão|aba|título|caixa|link|diálogo|campo|texto) /g, ' › $1 ');

function wrapLocator(loc: Locator, ev: Evidence): Locator {
  return new Proxy(loc, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target) as unknown;
      if (typeof v !== 'function' || !wrappable(prop)) return v;
      return (...args: unknown[]) => {
        const out = (v as (...a: unknown[]) => unknown).apply(target, args);
        if (isLocator(out)) return wrapLocator(out, ev);
        const verb = typeof prop === 'string' ? LOCATOR_ACTIONS[prop] : undefined;
        if (!verb) return out;
        const extra = argText(args);
        return (out as Promise<unknown>).then(async (r) => {
          await ev.action(`${verb} ${describeLocator(target)}${extra ? ` (${extra})` : ''}`);
          return r;
        });
      };
    },
  });
}

function wrapKeyboard(kb: Keyboard, ev: Evidence): Keyboard {
  const actions: Record<string, string> = { press: 'Tecla', type: 'Digitar', insertText: 'Inserir texto' };
  return new Proxy(kb, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target) as unknown;
      if (typeof v !== 'function' || !wrappable(prop)) return v;
      const verb = typeof prop === 'string' ? actions[prop] : undefined;
      if (!verb) return (v as (...a: unknown[]) => unknown).bind(target);
      return async (...args: unknown[]) => {
        const r = await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        await ev.action(`${verb} ${argText(args.slice(0, 1))}`);
        return r;
      };
    },
  });
}

function wrapMouse(mouse: Mouse, ev: Evidence): Mouse {
  let at = { x: 0, y: 0 };
  const where = (): string => `(${Math.round(at.x)}, ${Math.round(at.y)}) da página`;
  return new Proxy(mouse, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target) as unknown;
      if (typeof v !== 'function' || !wrappable(prop)) return v;
      return async (...args: unknown[]) => {
        if (prop === 'move' || prop === 'click' || prop === 'dblclick') at = { x: args[0] as number, y: args[1] as number };
        const r = await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        if (prop === 'down') await ev.action(`Mouse: aperta o botão em ${where()}`);
        else if (prop === 'up') await ev.action(`Mouse: solta o botão em ${where()}`);
        else if (prop === 'click' || prop === 'dblclick') await ev.action(`Mouse: ${prop === 'click' ? 'clique' : 'duplo clique'} em ${where()}`);
        return r;
      };
    },
  });
}

/** Página que registra evidência a cada ação feita por ela (locators, teclado, mouse). */
export function wrapPage(page: Page, ev: Evidence): Page {
  if (ev.level === 'off') return page;
  const keyboard = wrapKeyboard(page.keyboard, ev);
  const mouse = wrapMouse(page.mouse, ev);
  return new Proxy(page, {
    get(target, prop) {
      if (prop === 'keyboard') return keyboard;
      if (prop === 'mouse') return mouse;
      const v = Reflect.get(target, prop, target) as unknown;
      if (typeof v !== 'function' || !wrappable(prop)) return v;
      return (...args: unknown[]) => {
        const out = (v as (...a: unknown[]) => unknown).apply(target, args);
        if (isLocator(out)) return wrapLocator(out, ev);
        const verb = typeof prop === 'string' ? LOCATOR_ACTIONS[prop] : undefined;
        if (!verb || !(out instanceof Promise)) return out;
        return out.then(async (r) => {
          await ev.action(`${verb} ${argText(args)}`);
          return r;
        });
      };
    },
  });
}
