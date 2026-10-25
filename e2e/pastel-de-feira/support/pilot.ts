/**
 * Lado do teste do piloto: empacota `pilot.browser.ts`, injeta na página e executa cada gesto com o
 * mouse e o teclado reais do Playwright até o corte das 14h.
 */
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import type { GamePage } from './game';
import type { Gesture } from './pilot.browser';

let bundle: string | null = null;

function pilotSource(): string {
  if (bundle) return bundle;
  const out = buildSync({
    entryPoints: [fileURLToPath(new URL('./pilot.browser.ts', import.meta.url))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
  });
  bundle = out.outputFiles[0].text;
  return bundle;
}

export interface PilotStats {
  gestures: number;
  misses: string[];
}

/** Joga o dia aberto até o fim com o piloto. Devolve quantos gestos fez e os que não acharam alvo. */
export async function playDayByPilot(game: GamePage): Promise<PilotStats> {
  const page = game.page;
  if (!(await page.evaluate(() => !!(window as unknown as { __pfPilot?: unknown }).__pfPilot))) {
    await page.addScriptTag({ content: pilotSource() });
  }
  await page.evaluate(() => (window as unknown as { __pfPilot: { start(): void } }).__pfPilot.start());
  let down = false;
  let mark = Date.now();
  for (let guard = 0; guard < 100_000; guard++) {
    if (process.env.PF_PILOT_DEBUG && guard % 50 === 0) {
      console.log(`gesto ${guard}: ${Date.now() - mark} ms, passo ${await game.hook((pf) => pf.sim.state.tick).catch(() => -1)}`);
      mark = Date.now();
    }
    const it = Date.now();
    const g = await page.evaluate(() => (window as unknown as { __pfPilot: { next(n: number): unknown } }).__pfPilot.next(1200)) as Gesture;
    if (process.env.PF_PILOT_DEBUG && Date.now() - it > 2000) console.log(`next() lento: ${Date.now() - it} ms -> ${JSON.stringify(g)}`);
    if (g.kind === 'over') break;
    const gt = Date.now();
    if (g.kind === 'budget') continue;
    if (g.kind === 'key') {
      await page.keyboard.press(g.code);
    } else if (g.kind === 'up') {
      if (down) await page.mouse.up();
      down = false;
    } else {
      const p = await game.toClient(g.x, g.y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      if (g.kind === 'tap') await page.mouse.up();
      else down = true;
    }
    if (process.env.PF_PILOT_DEBUG && Date.now() - gt > 2000) console.log(`gesto lento: ${Date.now() - gt} ms -> ${JSON.stringify(g)}`);
  }
  if (down) await page.mouse.up();
  if (process.env.PF_PILOT_DEBUG) console.log('fim do dia');
  return page.evaluate(() => (window as unknown as { __pfLastStats?: PilotStats; __pfPilot: { stats(): PilotStats } }).__pfPilot.stats());
}
