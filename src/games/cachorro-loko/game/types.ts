export type PowerKind = 'turbo' | 'grau' | 'ima' | 'dobro';
export type BoxKind = 'normal' | PowerKind | 'vida' | 'bomba';
export type NormalLook = 'caixa' | 'pizza' | 'sacola';

export type BoxState =
  /** saindo do restaurante, caindo na 1ª esteira */
  | 'chute'
  /** andando numa esteira */
  | 'belt'
  /** descendo de uma esteira para a próxima */
  | 'drop'
  /** arremessado para a rua: é aqui que o cachorro pega */
  | 'street';

export interface Box {
  id: number;
  kind: BoxKind;
  look: NormalLook;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: BoxState;
  belt: number;
}

export interface HudState {
  phase: 'playing' | 'paused' | 'over';
  score: number;
  record: number;
  newRecord: boolean;
  lives: number;
  level: number;
  /** segundos restantes de cada poder ativo */
  powers: Partial<Record<PowerKind, number>>;
}
