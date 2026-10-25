/**
 * Descritores do cabeçalho das evidências. Um descritor é uma função serializada que roda no navegador,
 * recebe `window` e devolve linhas `[rótulo, valor]`. A parte genérica (rota, tela, diálogo, mensagem)
 * vale para todos os jogos; cada jogo acrescenta o próprio estado (spec 3.4) em `e2e/<id>/support/describe.ts`.
 */

export type Details = [string, string][];

/** Função serializável do descritor: roda na página, precisa ser autocontida. */
export type DescribeFn = (w: Window) => Details;

export interface Describer {
  /** Código-fonte da função `(w: Window) => [string, string][]`. */
  src: string;
}

/** Empacota uma função autocontida como descritor. */
export function describer(fn: DescribeFn): Describer {
  return { src: fn.toString() };
}

/** Parte genérica: rota, tela do jogo (`h1/h2` visível dentro de `root`, ou Hub), diálogos e mensagens. */
export function screenDescriber(root: string): Describer {
  const fn = (w: Window, sel: string): [string, string][] => {
    const d = w.document;
    const out: [string, string][] = [];
    const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: Element): boolean => (el as HTMLElement).offsetParent !== null || (el as HTMLElement).getClientRects().length > 0;
    out.push(['Rota', w.location.hash || '#/']);
    const rootEl = sel ? d.querySelector(sel) : null;
    if (!rootEl) {
      out.push(['Tela', 'Hub (fora do jogo)']);
    } else {
      const h = [...rootEl.querySelectorAll('h1, h2')].filter(shown).map(text).filter(Boolean);
      out.push(['Tela', h[0] ?? (rootEl.querySelector('canvas') ? 'Partida (canvas)' : '(sem título)')]);
    }
    const dialogs = [...d.querySelectorAll('[role=dialog]')].filter(shown).map((x) => x.getAttribute('aria-label') || text(x).slice(0, 80));
    if (dialogs.length) out.push(['Diálogo', dialogs.join(' | ')]);
    const status = [...d.querySelectorAll('[role=status], [role=alert]')].filter(shown).map(text).filter(Boolean);
    if (status.length) out.push(['Mensagem', status.join(' | ').slice(0, 200)]);
    return out;
  };
  return { src: `(w) => (${fn.toString()})(w, ${JSON.stringify(root)})` };
}
