import type { Level } from './ai';
import type { RuleSet } from './rules';

/** pvc: contra o computador · pvp: duas pessoas no mesmo aparelho */
export type GameMode = 'pvc' | 'pvp';
/** Quem dá a saída na primeira partida (depois alterna). */
export type BreakChoice = 'p1' | 'p2' | 'random';

export interface Settings {
  mode: GameMode;
  rules: RuleSet;
  /** Força do computador (1 a 3). */
  level: Level;
  /** pvc: [você, —] · pvp: [jogador 1, jogador 2]. */
  names: [string, string];
  breaker: BreakChoice;
}

export interface HudPlayer {
  name: string;
  cpu: boolean;
  /** Nome do grupo ("Lisas") ou null com a mesa aberta. */
  group: string | null;
  /** Bolas do grupo ainda na mesa. */
  left: number;
  /** Já pode matar a bola castigo. */
  onCastigo: boolean;
  wins: number;
}

export interface HudState {
  players: [HudPlayer, HudPlayer];
  turn: 0 | 1;
  castigo: number;
  /** O jogador humano da vez pode mirar e bater. */
  canShoot: boolean;
  /** Força da tacada (0–1). */
  power: number;
  ballInHand: boolean;
  thinking: boolean;
  winner: 0 | 1 | null;
  endReason: string | null;
}
