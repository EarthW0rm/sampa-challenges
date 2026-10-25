import type { ComponentType } from 'react';

/** O que o hub passa para o componente raiz de cada jogo. */
export interface GameProps {
  /** Volta para a lista de jogos. */
  onExit: () => void;
}

/**
 * Ficha de um jogo. Cada pasta em `src/games/<id>/` exporta uma destas em `manifest.ts`
 * e o hub encontra sozinho — não há lista central para editar.
 */
export interface GameManifest {
  /** Igual ao nome da pasta; vira a URL `#/jogos/<id>`. */
  id: string;
  title: string;
  /** Uma ou duas frases para o card. */
  description: string;
  /** Imagem do card (importe um PNG da pasta `assets` do jogo). */
  cover: string;
  /** Ex.: "1–2 jogadores", "Arcade". */
  tags: string[];
  /** Cor de destaque do card. */
  accent: string;
  /** Ordem na lista (menor primeiro). */
  order?: number;
  /** Recorde salvo, se o jogo tiver um. */
  getRecord?: () => number | null;
  /** Como mostrar o recorde no card (ex.: "dia 7", "R$ 1.962,00"). Sem ele, o card mostra o número. */
  formatRecord?: (record: number) => string;
  /** Carrega o jogo só quando alguém abre (code splitting). */
  load: () => Promise<{ default: ComponentType<GameProps> }>;
}
