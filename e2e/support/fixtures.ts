/**
 * Fixtures comuns: `page` registra evidência a cada ação e tira a captura final (resultado e erro);
 * `composer` monta os PNGs numa página à parte (por worker); `game` é a página do jogo e coleta os erros
 * do console (o teste falha se houver).
 */
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import type { Describer } from './describe';
import { Evidence, evidenceLevel, wrapPage, type Composer, type EvidenceLevel } from './evidence';

export { expect };

export interface EvidenceOptions {
  /** Nível das evidências do projeto (`E2E_EVIDENCIAS` e `PF_EVIDENCIAS` têm prioridade). */
  evidencias: EvidenceLevel;
}

interface WithErrors {
  readonly errors: string[];
}

/** Monta o `test` de um jogo: `factory` cria a página do jogo; `describers` compõem o cabeçalho. */
export function makeTest<G extends WithErrors>(factory: (page: Page, ev: Evidence) => G, describers: readonly Describer[]) {
  const evidenceOf = new WeakMap<Page, Evidence>();
  return base.extend<EvidenceOptions & { game: G }, { composer: Composer }>({
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
      const ev = new Evidence(raw, testInfo, evidenceLevel(evidencias), composer, describers);
      const page = wrapPage(raw, ev);
      evidenceOf.set(page, ev);
      await use(page);
      await ev.final();
    },
    game: async ({ page }, use) => {
      const g = factory(page, evidenceOf.get(page)!);
      page.on('pageerror', (e) => g.errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') g.errors.push(`console: ${m.text()}`);
      });
      await use(g);
      expect(g.errors, 'erros no console da página').toEqual([]);
    },
  });
}
