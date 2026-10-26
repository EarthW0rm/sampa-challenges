/**
 * Autoverificação da base comum (sem depender de nenhum jogo): relógio, semente, storage, evidências,
 * página base, piloto e contrato do gancho. O "jogo" aqui é uma página de brinquedo servida pelo próprio
 * teste (`page.route`) na origem do Vite, para poder importar módulos de `src/`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { describer, screenDescriber, type Describer } from './describe';
import { Evidence, type Composer } from './evidence';
import { expect, makeTest } from './fixtures';
import { BaseGamePage, type BaseBootOptions } from './game-page';
import { runPilot, type Gesture, type Strategy } from './pilot';

/** Estado do brinquedo: um quadrado que muda de lugar a cada clique certo. */
interface Toy {
  frames: number;
  dts: number[];
  rnd: number[];
  held: number;
  score: number;
  sq: { x: number; y: number; s: number };
}

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><title>harness</title>
<style>body{margin:0;background:#fff} .harness canvas{width:640px;height:400px;margin:40px 0 0 60px;display:block;background:#eee}</style></head>
<body><div class="harness"><h1>Harness</h1><canvas width="320" height="200"></canvas></div>
<script>
  const st = { frames: 0, dts: [], rnd: [Math.random(), Math.random(), Math.random()], held: 0, score: 0, sq: { x: 20, y: 20, s: 20 } };
  const down = new Set();
  addEventListener('keydown', (e) => down.add(e.key));
  addEventListener('keyup', (e) => down.delete(e.key));
  const cv = document.querySelector('canvas');
  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) * 320) / r.width, y = ((e.clientY - r.top) * 200) / r.height;
    const q = st.sq;
    if (x >= q.x && x <= q.x + q.s && y >= q.y && y <= q.y + q.s) {
      st.score++;
      q.x = Math.floor(Math.random() * 280); q.y = Math.floor(Math.random() * 160);
    }
  });
  let last = performance.now();
  function loop(t) { st.dts.push(t - last); last = t; st.frames++; if (down.has('ArrowRight')) st.held++; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  window.__toy = st;
</script>
<script type="module">
  import { exposeE2E } from '/src/shared/e2e/hook.ts';
  window.__hookModule = { exposeE2E };
  window.__hookReady = true;
</script></body></html>`;

const toyDescriber = describer((w) => {
  const t = (w as unknown as { __toy?: Toy }).__toy;
  return t ? [['Brinquedo', `quadros ${t.frames}, pontos ${t.score}, quadrado em (${t.sq.x}, ${t.sq.y})`]] : [];
});

class HarnessPage extends BaseGamePage<Toy> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'harness', path: './__harness/', root: '.harness', logical: { w: 320, h: 200 }, hookName: '__e2e', soundOff: { 'harness:som': 'off' } });
  }

  override async boot(opts: BaseBootOptions = {}): Promise<void> {
    await this.page.route('**/__harness/', (r) => r.fulfill({ contentType: 'text/html', body: HARNESS }));
    await super.boot(opts);
    await this.page.waitForFunction(() => (window as unknown as { __hookReady?: boolean }).__hookReady === true);
  }

  toy(): Promise<Toy> {
    return this.page.evaluate(() => (window as unknown as { __toy: Toy }).__toy);
  }

  /** Publica o brinquedo no gancho genérico (o próprio módulo `src/shared/e2e/hook.ts`). */
  async exposeToy(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as { __toy: Toy; __hookModule: { exposeE2E: (id: string, api: unknown) => () => void } };
      w.__hookModule.exposeE2E('harness', w.__toy);
    });
  }
}

const test = makeTest((page, ev) => new HarnessPage(page, ev), [screenDescriber('.harness'), toyDescriber]);

/** mulberry32 de referência (o mesmo do relógio). */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pngs = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []);
const envLevel = process.env.E2E_EVIDENCIAS ?? process.env.PF_EVIDENCIAS;

test.describe('relógio', () => {
  test('quadros só andam com __e2eFrames', async ({ game, page }) => {
    await game.boot();
    const before = (await game.toy()).frames;
    await page.waitForTimeout(300);
    expect((await game.toy()).frames, 'nada anda sozinho').toBe(before);
    await game.frames(3);
    expect((await game.toy()).frames).toBe(before + 3);
    expect(await game.rafPending(), 'um laço vivo').toBe(1);
  });

  test('tempo virtual: cada quadro tem dt = 1000/60, inclusive o primeiro', async ({ game }) => {
    await game.boot();
    await game.frames(10);
    const { dts } = await game.toy();
    expect(dts).toHaveLength(10);
    for (const dt of dts) expect(dt).toBeCloseTo(1000 / 60, 9);
  });

  test('jump gera um quadro com dt grande', async ({ game }) => {
    await game.boot();
    await game.frames(1);
    await game.jump(5000);
    await game.frames(1);
    const { dts } = await game.toy();
    expect(dts[1]).toBeCloseTo(5000 + 1000 / 60, 6);
  });

  test('Math.random segue a semente e repete na recarga', async ({ game, page }) => {
    await game.boot({ seed: 42 });
    const first = (await game.toy()).rnd;
    const ref = mulberry(42);
    expect(first).toEqual([ref(), ref(), ref()]);
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __toy?: unknown }).__toy);
    expect((await game.toy()).rnd, 'mesma semente, mesma sequência').toEqual(first);
  });

  test('storage: som desligado, valores crus e preparo único por teste', async ({ game, page }) => {
    await game.boot({ storage: { 'harness:recorde': '7' }, rawStorage: { 'harness:config': '{quebrado' } });
    const read = () => page.evaluate(() => [localStorage.getItem('harness:som'), localStorage.getItem('harness:recorde'), localStorage.getItem('harness:config')]);
    expect(await read()).toEqual(['off', '7', '{quebrado']);
    await page.evaluate(() => localStorage.setItem('harness:recorde', '9'));
    await page.reload();
    expect((await read())[1], 'recarga preserva o que o jogo gravou').toBe('9');
  });

  test('ir para about:blank não gera erro na página', async ({ game, page }) => {
    await game.boot();
    await page.goto('about:blank');
    await page.goBack();
    await page.waitForFunction(() => !!(window as unknown as { __toy?: unknown }).__toy);
  });

  test('storage bloqueado lança ao acessar', async ({ game, page }) => {
    await game.boot({ blockStorage: true });
    const msg = await page.evaluate(() => {
      try {
        localStorage.getItem('x');
        return 'ok';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(msg).toBe('bloqueado');
  });
});

test.describe('evidências', () => {
  test.skip(!!envLevel, 'nível forçado por variável de ambiente');

  test('cada ação vira um PNG numerado', async ({ game }) => {
    await game.boot();
    await game.pressKey('ArrowRight');
    await game.tapAt(30, 30);
    const files = pngs(game.ev.folder);
    expect(files[0]).toMatch(/^001-marco-jogo-aberto/);
    expect(files[1]).toMatch(/^002-acao-tecla-arrowright/);
    expect(files[2]).toMatch(/^003-acao-toque-no-canvas/);
  });

  test.describe('nível marcos', () => {
    test.use({ evidencias: 'marcos' });
    test('não grava ações', async ({ game }) => {
      await game.boot();
      await game.pressKey('ArrowRight');
      await game.evidence('marco explícito');
      const files = pngs(game.ev.folder);
      expect(files).toHaveLength(2);
      expect(files[1]).toMatch(/^002-marco-marco-explicito/);
    });
  });

  test.describe('nível off', () => {
    test.use({ evidencias: 'off' });
    test('não cria a pasta', async ({ game }) => {
      await game.boot();
      await game.pressKey('ArrowRight');
      expect(existsSync(game.ev.folder)).toBe(false);
    });
  });

  test('descritor que lança não derruba o teste', async ({ game, page, composer }, testInfo) => {
    await game.boot();
    const bad: Describer = { src: '(w) => { throw new Error("descritor quebrado") }' };
    const ev = new Evidence(page, { ...testInfo, title: `${testInfo.title} (extra)` } as typeof testInfo, 'acoes', composer as Composer, [bad]);
    await ev.milestone('com descritor quebrado');
    expect(pngs(ev.folder)).toHaveLength(1);
  });
});

test.describe('página base', () => {
  test('toClient mapeia os cantos do canvas', async ({ game }) => {
    await game.boot();
    const box = (await game.canvas.boundingBox())!;
    expect(await game.toClient(0, 0)).toEqual({ x: box.x, y: box.y });
    const end = await game.toClient(320, 200);
    expect(end.x).toBeCloseTo(box.x + box.width, 6);
    expect(end.y).toBeCloseTo(box.y + box.height, 6);
  });

  test('holdKey segura por N quadros exatos', async ({ game }) => {
    await game.boot();
    await game.holdKey('ArrowRight', 30);
    await game.frames(5);
    expect((await game.toy()).held).toBe(30);
  });

  test('hook sem gancho dá erro claro; advanceUntil estourado dá erro com a condição', async ({ game }) => {
    await game.boot();
    await expect(game.hook((t) => t.score)).rejects.toThrow('gancho __e2e ausente (harness)');
    await game.exposeToy();
    expect(await game.hook((t) => t.score)).toBe(0);
    await expect(game.advanceUntil((t) => t.score > 99, 0.5)).rejects.toThrow(/advanceUntil: condição não ocorreu em 0.5 s/);
  });

  test('expect sobre locator embrulhado mostra o erro real', async ({ game, page }) => {
    await game.boot();
    await page.evaluate(() => {
      const i = document.createElement('input');
      i.value = 'abc';
      document.querySelector('.harness')!.append(i);
    });
    await expect(page.locator('.harness input')).toHaveValue('abc');
    await expect(expect(page.locator('.harness input')).toHaveValue('xyz', { timeout: 300 })).rejects.toThrow(/toHaveValue/);
    await expect(expect(page.locator('.harness h1')).toHaveText('Outro', { timeout: 300 })).rejects.toThrow(/toHaveText/);
  });

  test('erro no console falha o teste', async ({ game, page }) => {
    test.fail();
    await game.boot();
    await page.evaluate(() => console.error('erro de propósito'));
  });
});

/** Estratégia de brinquedo: clica no quadrado até fazer `goal` pontos. */
function toyStrategy(goal: number, aim: 'certo' | 'fora' = 'certo'): Strategy<Toy, HarnessPage> {
  let tries = 0;
  return {
    name: 'brinquedo',
    read: (g) => g.toy(),
    decide: (s): Gesture => {
      tries++;
      return aim === 'certo'
        ? { kind: 'tap', x: s.sq.x + s.sq.s / 2, y: s.sq.y + s.sq.s / 2, frames: 2, target: 'quadrado' }
        : { kind: 'tap', x: 319, y: 199, frames: 2, target: null };
    },
    over: (s) => s.score >= goal || (aim === 'fora' && tries >= 5),
    result: (s) => ({ pontos: s.score }),
  };
}

test.describe('piloto', () => {
  test('termina a partida e grava o diagnóstico', async ({ game }, testInfo) => {
    await game.boot({ seed: 7 });
    const run = await runPilot(game, toyStrategy(5), { seed: 7, variant: 'brinquedo', maxFrames: 600, testInfo });
    expect(run.status).toBe('fim');
    expect(run.result).toEqual({ pontos: 5 });
    const json = JSON.parse(readFileSync(run.file, 'utf8')) as Record<string, unknown>;
    for (const k of ['jogo', 'variante', 'semente', 'status', 'quadros', 'comandos', 'resultado']) expect(json, k).toHaveProperty(k);
    expect(json.jogo).toBe('harness');
    expect((json.comandos as { g: string }[])[0].g).toMatch(/^tap:/);
  });

  test('partida que não termina estoura maxFrames', async ({ game }, testInfo) => {
    await game.boot();
    const never: Strategy<Toy, HarnessPage> = { ...toyStrategy(1), decide: () => null, over: () => false };
    await expect(runPilot(game, never, { seed: 1, variant: 'trava', maxFrames: 60, testInfo })).rejects.toThrow(/não terminou em 60 quadros/);
    const json = JSON.parse(readFileSync(testInfo.outputPath('partida-1.json'), 'utf8')) as { status: string };
    expect(json.status).toBe('travou');
  });

  test('gesto sem alvo conta como perdido', async ({ game }, testInfo) => {
    await game.boot();
    const run = await runPilot(game, toyStrategy(1, 'fora'), { seed: 1, variant: 'fora', maxFrames: 600, failOnMiss: false, testInfo });
    expect(run.missed).toBeGreaterThan(0);
    expect(run.commands.every((c) => c.alvo === null)).toBe(true);
    await expect(runPilot(game, toyStrategy(1, 'fora'), { seed: 1, variant: 'fora', maxFrames: 600, match: 2, testInfo })).rejects.toThrow(/sem alvo \(RN-21\)/);
  });
});

test.describe('gancho (src/shared/e2e/hook.ts)', () => {
  type HookWin = { __E2E__?: boolean; __PF_E2E__?: boolean; __e2e?: { id: string } | null; __e2eLast?: { id: string }; __hookModule: { exposeE2E: (id: string, api: unknown) => () => void } };

  test('sem a flag não publica nada', async ({ game, page }) => {
    await game.boot();
    const out = await page.evaluate(() => {
      const w = window as unknown as HookWin;
      delete w.__E2E__;
      delete w.__PF_E2E__;
      const dispose = w.__hookModule.exposeE2E('x', { a: 1 });
      dispose();
      return { e2e: w.__e2e ?? null, last: w.__e2eLast ?? null };
    });
    expect(out).toEqual({ e2e: null, last: null });
  });

  test('com a flag publica { id, api } e o último', async ({ game, page }) => {
    await game.boot();
    await game.exposeToy();
    expect(await page.evaluate(() => (window as unknown as HookWin).__e2e?.id)).toBe('harness');
    expect(await game.hook((t) => t.frames)).toBe(0);
  });

  test('StrictMode: o dispose da 1ª montagem não apaga a 2ª', async ({ game, page }) => {
    await game.boot();
    const out = await page.evaluate(() => {
      const w = window as unknown as HookWin;
      const d1 = w.__hookModule.exposeE2E('um', {});
      const d2 = w.__hookModule.exposeE2E('dois', {});
      d1();
      const afterFirst = w.__e2e?.id ?? null;
      d2();
      return { afterFirst, afterSecond: w.__e2e ?? null, last: w.__e2eLast?.id };
    });
    expect(out).toEqual({ afterFirst: 'dois', afterSecond: null, last: 'dois' });
  });
});
