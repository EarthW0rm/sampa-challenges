export type Dir = 0 | 1 | 2 | 3; // 0 direita, 1 baixo, 2 esquerda, 3 cima
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;

/** Quem pode entrar em cada tipo de tile. */
export type MoverClass = 'player' | 'moto' | 'car';

export type MapId = 'centro' | 'paulista' | 'marginal';

export type JobKind = 'normal' | 'fragil' | 'urgente' | 'pesado';
export type ItemKind = 'turbo' | 'oleo' | 'capacete' | 'pizza' | 'vida';

export type Phase = 'ready' | 'play' | 'caught' | 'over' | 'paused';

export interface HudState {
  phase: Phase;
  score: number;
  record: number;
  newRecord: boolean;
  lives: number;
  stars: number;
  heat: number;
  turbo: number;
  turboLocked: boolean;
  shield: boolean;
  oil: number;
  hidden: boolean;
  hideLeft: number;
  deliveries: number;
  job: { kind: JobKind; stage: 'pickup' | 'drop'; timeLeft: number | null } | null;
  message: string;
  map: MapId;
}
