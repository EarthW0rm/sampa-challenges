/**
 * Contrato do gancho dos testes de ponta a ponta (`e2e/`). Só existe quando a página de teste define
 * `window.__E2E__` (ou `window.__PF_E2E__`) antes de carregar o jogo; para o jogador tudo aqui é inerte.
 *
 * Cada jogo publica, no efeito que cria o motor, uma API de leitura (`state()`, `targets()` e, para
 * pré-condições raras, `prepare`) e chama o `dispose` devolvido no cleanup.
 */

export interface E2EEntry<T = unknown> {
  id: string;
  api: T;
}

export type E2EWindow = Window & {
  __E2E__?: boolean;
  __PF_E2E__?: boolean;
  /** Gancho do jogo montado agora (`null` depois do cleanup). */
  __e2e?: E2EEntry | null;
  /** Gancho da última montagem (vale depois que a tela desmontou). */
  __e2eLast?: E2EEntry;
};

/** A página é de teste? */
export function isE2E(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as E2EWindow;
  return !!(w.__E2E__ || w.__PF_E2E__);
}

/**
 * Publica `window.__e2e = { id, api }` (e `__e2eLast`). Devolve o `dispose` do cleanup: só limpa se o
 * gancho publicado ainda for este (no StrictMode a 2ª montagem substitui a 1ª e o `dispose` da 1ª não a apaga).
 */
export function exposeE2E<T>(id: string, api: T): () => void {
  if (!isE2E()) return () => {};
  const w = window as E2EWindow;
  const entry: E2EEntry<T> = { id, api };
  w.__e2e = entry;
  w.__e2eLast = entry;
  return () => {
    if (w.__e2e === entry) w.__e2e = null;
  };
}

/** Semente para sorteios fora da página (worker de IA): segue o `Math.random` já semeado do teste. */
export function e2eSeed(): number | undefined {
  return isE2E() ? Math.floor(Math.random() * 2 ** 32) : undefined;
}
