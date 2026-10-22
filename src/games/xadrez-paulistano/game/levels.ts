import {
  AI_BLUNDER_MAX,
  AI_DEPTH_MAX,
  AI_NOISE_MAX,
  AI_NOISE_MIN,
  AI_QUIESCENCE_FROM,
  AI_TIME_MAX_MS,
  AI_TIME_MIN_MS,
  LEVEL_MAX,
  LEVEL_MIN,
} from './constants';

/** Como o computador pensa num nível de 1 a 100. */
export interface LevelProfile {
  /** Profundidade máxima da busca (lances de cada lado somados). */
  depth: number;
  /** Tempo máximo de busca por lance. */
  timeMs: number;
  /** Ruído (centipeões) somado à nota de cada lance antes de escolher: quanto maior, mais "chute". */
  noise: number;
  /** Chance de jogar um lance legal qualquer, sem pensar. */
  blunder: number;
  /** Continua olhando as trocas no fim da busca (sem isso deixa peça pendurada). */
  quiescence: boolean;
}

export const clampLevel = (level: number) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(level)));

export function levelProfile(level: number): LevelProfile {
  const L = clampLevel(level);
  const t = (L - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN); // 0 no nível 1, 1 no mestre
  const noise = AI_NOISE_MAX * (1 - t) ** 2;
  return {
    depth: L === LEVEL_MAX ? AI_DEPTH_MAX : 1 + Math.floor(t * 7),
    timeMs: Math.round(AI_TIME_MIN_MS + (AI_TIME_MAX_MS - AI_TIME_MIN_MS) * t * t),
    noise: noise < AI_NOISE_MIN ? 0 : Math.round(noise),
    blunder: AI_BLUNDER_MAX * (1 - t) ** 3,
    quiescence: L >= AI_QUIESCENCE_FROM,
  };
}

/** Nome da faixa de dificuldade mostrado ao lado da barra. */
export function levelLabel(level: number): string {
  const L = clampLevel(level);
  if (L === LEVEL_MAX) return 'Mestre';
  if (L >= 81) return 'Especialista';
  if (L >= 61) return 'Avançado';
  if (L >= 41) return 'Clube';
  if (L >= 21) return 'Casual';
  return 'Iniciante';
}
