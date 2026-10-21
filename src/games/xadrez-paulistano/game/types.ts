import type { Color, Outcome } from './chess';

/** pvc: contra o computador · pvp: duas pessoas no mesmo aparelho */
export type GameMode = 'pvc' | 'pvp';
export type ColorChoice = 'white' | 'black' | 'random';

export interface Settings {
  mode: GameMode;
  /** Força do computador, de 1 a 100 (100 = mestre). */
  level: number;
  /** Cor de quem joga contra o computador. */
  color: ColorChoice;
  /** pvc: [você, —] · pvp: [brancas, pretas]. */
  names: [string, string];
  /** pvp: o tabuleiro gira para quem vai jogar. */
  autoFlip: boolean;
}

export interface HudState {
  turn: Color;
  /** Lances jogados em notação algébrica (português). */
  moves: string[];
  outcome: Outcome | null;
  check: boolean;
  thinking: boolean;
  /** Cor que está escolhendo a peça da promoção, ou null. */
  promotion: Color | null;
  canUndo: boolean;
  /** Cor que está embaixo no tabuleiro. */
  bottom: Color;
  /** pvc: cor do jogador humano. */
  humanColor: Color | null;
  /** Nome de quem joga com as brancas e com as pretas. */
  names: [string, string];
}
