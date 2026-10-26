export type Phase = 'ready' | 'play' | 'bonus' | 'over' | 'paused';

export interface HudState {
  phase: Phase;
  score: number;
  record: number;
  newRecord: boolean;
  ball: number;
  ballsTotal: number;
  mult: number;
  letters: boolean[];
  rolls: boolean[];
  greens: number;
  wave: boolean;
  saver: boolean;
  multiball: boolean;
  tilt: boolean;
  extra: boolean;
  message: string;
  bonus: { base: number; mult: number; total: number } | null;
  charge: number;
}

/** Tipos de evento que dão pontos (ver `PTS` em `constants.ts`); `bonus` é o bônus de fim de bola. */
export type ScoreKind =
  | 'bumper'
  | 'semaforoVerde'
  | 'ondaVerde'
  | 'raia'
  | 'raias'
  | 'letraNova'
  | 'letraAcesa'
  | 'multiball'
  | 'minhocao'
  | 'premioPontos'
  | 'premioLetraCheia'
  | 'spinner'
  | 'estilingue'
  | 'bonus';
