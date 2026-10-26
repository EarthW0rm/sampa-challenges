/**
 * Executor genérico do jogador automático (plan.md 4.3): lê o estado pelo gancho, pede a decisão à
 * estratégia do jogo e executa cada decisão como gesto real (tecla, toque, arraste, clique). Para no fim
 * de jogo ou ao estourar `maxFrames`, e grava o diagnóstico da partida (`partida-<n>.json`).
 *
 * Gesto sem alvo (`target: null`) é registrado e faz o teste falhar ao fim (spec RN-21).
 * `E2E_PILOT_DEBUG=1` imprime o ritmo dos gestos.
 */
import type { TestInfo } from '@playwright/test';
import { writeMatch, type MatchCommand, type MatchRecord, type MatchStatus } from './diagnostics';
import type { BaseGamePage } from './game-page';

type Point = { x: number; y: number };

/** Gesto decidido pela estratégia. Coordenadas são lógicas do canvas; `frames` é quanto o gesto dura. */
export type Gesture = { target: string | null } & (
  | { kind: 'key'; key: string; frames: number }
  | { kind: 'tap'; x: number; y: number; frames?: number }
  | { kind: 'hold'; x: number; y: number; frames: number }
  | { kind: 'drag'; from: Point; to: Point; frames: number }
  | { kind: 'click'; selector: string; frames?: number }
  | { kind: 'fill'; selector: string; value: string }
  | { kind: 'wait'; frames: number }
);

export interface Strategy<S, G> {
  name: string;
  /** Lê o estado da partida (pelo gancho). */
  read(game: G): Promise<S>;
  /** Próximo gesto; `null` = só deixar o jogo andar `decideEvery` quadros. */
  decide(s: S): Gesture | null;
  /** A partida acabou? */
  over(s: S): boolean;
  /** Resultado lido do jogo (e o recalculado pela estratégia) para o diagnóstico. */
  result(s: S): Record<string, unknown>;
}

export interface PilotOptions {
  seed: number;
  variant: string;
  /** Teto de quadros da partida (status `travou` ao estourar). */
  maxFrames: number;
  /** Quadros que o jogo anda quando a estratégia não decide nada (padrão 6). */
  decideEvery?: number;
  /** Número da partida no arquivo de diagnóstico (padrão 1). */
  match?: number;
  /** Falhar quando houver gesto sem alvo (padrão `true`). */
  failOnMiss?: boolean;
  testInfo: TestInfo;
}

export interface PilotRun {
  status: MatchStatus;
  frames: number;
  result: Record<string, unknown>;
  missed: number;
  file: string;
  commands: MatchCommand[];
}

const describeGesture = (g: Gesture): string => {
  switch (g.kind) {
    case 'key':
      return `key:${g.key}:${g.frames}`;
    case 'tap':
      return `tap:${Math.round(g.x)},${Math.round(g.y)}`;
    case 'hold':
      return `hold:${Math.round(g.x)},${Math.round(g.y)}:${g.frames}`;
    case 'drag':
      return `drag:${Math.round(g.from.x)},${Math.round(g.from.y)}>${Math.round(g.to.x)},${Math.round(g.to.y)}`;
    case 'click':
      return `click:${g.selector}`;
    case 'fill':
      return `fill:${g.selector}=${g.value}`;
    case 'wait':
      return `wait:${g.frames}`;
  }
};

async function perform(game: BaseGamePage<unknown>, g: Gesture): Promise<number> {
  const page = game.page;
  switch (g.kind) {
    case 'key':
      if (g.frames <= 0) {
        await page.keyboard.press(g.key);
        return 0;
      }
      await page.keyboard.down(g.key);
      await game.frames(g.frames);
      await page.keyboard.up(g.key);
      return g.frames;
    case 'tap': {
      const p = await game.toClient(g.x, g.y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.up();
      const f = g.frames ?? 1;
      await game.frames(f);
      return f;
    }
    case 'hold': {
      const p = await game.toClient(g.x, g.y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await game.frames(g.frames);
      await page.mouse.up();
      return g.frames;
    }
    case 'drag': {
      const a = await game.toClient(g.from.x, g.from.y);
      const b = await game.toClient(g.to.x, g.to.y);
      const n = Math.max(1, g.frames);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= n; i++) {
        await page.mouse.move(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
        await game.frames(1);
      }
      await page.mouse.up();
      return n;
    }
    case 'click': {
      await page.locator(g.selector).first().click();
      const f = g.frames ?? 1;
      await game.frames(f);
      return f;
    }
    case 'fill':
      await page.locator(g.selector).first().fill(g.value);
      return 0;
    case 'wait':
      await game.frames(g.frames);
      return g.frames;
  }
}

/** Joga uma partida inteira com a estratégia. Lança se travar, se a estratégia lançar ou se houver gesto sem alvo. */
export async function runPilot<S, G extends BaseGamePage<unknown>>(game: G, strategy: Strategy<S, G>, opts: PilotOptions): Promise<PilotRun> {
  const commands: MatchCommand[] = [];
  const every = opts.decideEvery ?? 6;
  const debug = !!process.env.E2E_PILOT_DEBUG;
  let frames = 0;
  let missed = 0;
  let status: MatchStatus = 'fim';
  let result: Record<string, unknown> = {};
  let failure: Error | null = null;
  let mark = Date.now();
  try {
    await game.ev.quiet(async () => {
      for (let i = 0; ; i++) {
        const s = await strategy.read(game);
        if (strategy.over(s)) {
          result = strategy.result(s);
          return;
        }
        if (frames >= opts.maxFrames) {
          status = 'travou';
          result = strategy.result(s);
          throw new Error(`[piloto ${strategy.name}] partida não terminou em ${opts.maxFrames} quadros (${opts.variant}, semente ${opts.seed})`);
        }
        const g = strategy.decide(s);
        if (!g) {
          await game.frames(every);
          frames += every;
          continue;
        }
        commands.push({ q: frames, g: describeGesture(g), alvo: g.target });
        if (g.target === null) missed++;
        frames += await perform(game, g);
        if (debug && i % 50 === 0) {
          console.log(`[piloto] gesto ${i}: ${Date.now() - mark} ms, quadro ${frames}`);
          mark = Date.now();
        }
      }
    });
  } catch (e) {
    failure = e as Error;
    if (status === 'fim') status = 'erro';
  }
  const record: MatchRecord = {
    jogo: game.cfg.id,
    variante: opts.variant,
    semente: opts.seed,
    status,
    quadros: frames,
    comandos: commands,
    resultado: result,
    erros: [...game.errors, ...(failure ? [failure.message] : [])],
  };
  const file = writeMatch(opts.testInfo, opts.match ?? 1, record);
  if (failure) throw failure;
  if (missed > 0 && opts.failOnMiss !== false) {
    throw new Error(`[piloto ${strategy.name}] ${missed} gesto(s) sem alvo (RN-21); veja ${file}`);
  }
  return { status, frames, result, missed, file, commands };
}
