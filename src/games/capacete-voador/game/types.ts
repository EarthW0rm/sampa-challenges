export type PlayerIndex = 0 | 1;

/** pvp: 2 jogadores · pvc: jogador vs computador · practice: treino contra um motoboy que não ataca */
export type GameMode = 'pvp' | 'pvc' | 'practice';
export type Difficulty = 'facil' | 'medio' | 'dificil';

export interface Settings {
  mode: GameMode;
  difficulty: Difficulty;
  names: [string, string];
  pointsToWin: number;
  gravity: number;
  rain: boolean;
}

export interface Shot {
  angle: number;
  velocity: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
