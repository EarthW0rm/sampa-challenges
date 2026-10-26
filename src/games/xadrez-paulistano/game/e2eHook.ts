import { exposeE2E } from '../../../shared/e2e/hook';
import type { XadrezEngine, XadrezE2EState } from './engine';

/** Retângulo de um botão em coordenadas de página (CSS px). */
export interface ButtonRect {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  disabled: boolean;
}

/**
 * Gancho dos testes de ponta a ponta (`e2e/xadrez-paulistano`). Só existe quando a página de teste liga
 * a flag (`src/shared/e2e/hook.ts`); para o jogador é inerte. Os testes jogam pela tela: o gancho só lê
 * estado e alvos; `prepare` serve só para pré-condição rara, comentada no teste.
 */
export interface XadrezE2E {
  state(): XadrezE2EState;
  /** Centro de cada casa (`a1`..`h8`) em coordenadas lógicas (320×200), respeitando o giro; botões da tela em coordenadas de página. */
  targets(): { squares: Record<string, { x: number; y: number }>; buttons: ButtonRect[] };
  prepare: {
    /** Começa uma partida a partir da posição `fen` (lista de lances vazia). */
    fen(fen: string): void;
  };
}

function buttons(): ButtonRect[] {
  return [...document.querySelectorAll<HTMLButtonElement>('.xadrez-paulistano button')].map((b) => {
    const r = b.getBoundingClientRect();
    return { label: (b.textContent ?? '').replace(/\s+/g, ' ').trim(), x: r.x, y: r.y, w: r.width, h: r.height, disabled: b.disabled };
  });
}

/** Publica o gancho do motor montado; devolve o `dispose` do cleanup do efeito. */
export function exposeGame(engine: XadrezEngine): () => void {
  return exposeE2E<XadrezE2E>('xadrez-paulistano', {
    state: () => engine.e2eState(),
    targets: () => ({ squares: engine.e2eTargets(), buttons: buttons() }),
    prepare: { fen: (fen) => engine.e2eSetFen(fen) },
  });
}
