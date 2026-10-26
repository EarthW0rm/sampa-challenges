/** Campo lógico vertical 240×400; o canvas é desenhado em W·SCALE × H·SCALE (480×800). */
export const W = 240;
export const H = 400;

/** Raio da bola (px lógicos). */
export const BALL_R = 5;
/** Gravidade ao longo da mesa inclinada (px/s²). */
export const GRAVITY = 430;
/** Velocidade máxima da bola (px/s). */
export const MAX_SPEED = 900;
/** Passo fixo da física (s). A física roda em subpassos de 1/480 s. */
export const STEP = 1 / 480;

/** Elasticidade (0 = massa, 1 = perfeito). */
export const E_WALL = 0.45;
export const E_FLIPPER = 0.35;
/** Abaixo desta velocidade normal (px/s) o quique é zerado: a bola "assenta" em vez de tremer. */
export const REST_SPEED = 40;

// ------------------------------------------------------------------ flippers
export const FLIPPER_LEN = 36;
/** Raio na base e na ponta (a colisão é uma cápsula que afina). */
export const FLIPPER_R0 = 6;
export const FLIPPER_R1 = 3.6;
/** Ângulos (rad, 0 = horizontal, positivo = para baixo): repouso e levantado. */
export const FLIPPER_REST = (30 * Math.PI) / 180;
export const FLIPPER_UP = (-26 * Math.PI) / 180;
/** Velocidade angular ao subir/descer (rad/s). A ponta chega a ~520 px/s. */
export const FLIPPER_OMEGA_UP = 15;
export const FLIPPER_OMEGA_DOWN = 9;
export const FLIPPER_PIVOT_L = { x: 70, y: 352 };
export const FLIPPER_PIVOT_R = { x: 152, y: 352 };

// ------------------------------------------------------------------ elementos
export const BUMPER_R = 11;
/** Velocidade mínima de saída da bola ao bater num bumper / estilingue (px/s). */
export const BUMPER_KICK = 270;
export const SLING_KICK = 230;
export const POST_R = 3;

export const KICKOUT = { x: 111, y: 232, r: 7 };
export const KICKOUT_HOLD = 1.1;

/** Bola parada na rampa de lançamento. */
export const LANE_X = 223;
export const LANE_FLOOR_Y = 396;
export const BALL_REST_Y = LANE_FLOOR_Y - BALL_R;
export const PLUNGER_MIN = 430;
export const PLUNGER_RANGE = 470;
/** Tempo (s) segurando Espaço até a mola chegar ao máximo. */
export const PLUNGER_CHARGE_TIME = 0.9;

/** Fora da tela por baixo = bola perdida. */
export const DRAIN_Y = H + 14;

// ------------------------------------------------------------------ regras
export const BALLS_PER_GAME = 3;
export const SAVER_SECONDS = 12;
export const MAX_MULT = 5;
export const NUDGE_LIMIT = 3;
/** Duração da Onda Verde (s): bumpers valem o dobro. */
export const WAVE_SECONDS = 15;
/** Batidas por estágio do semáforo: 0–2 vermelho, 3–5 amarelo, 6+ verde (`2 × SEMAFORO_HITS`). */
export const SEMAFORO_HITS = 3;
/** Segura-bola dado pelo prêmio do Minhocão (s). */
export const SAVER_AWARD_SECONDS = 15;
/** Tempo da tela de bônus de fim de bola (s). */
export const BONUS_SECONDS = 3.4;

// ------------------------------------------------------------------ pontos
/** Pontos de cada evento (somados ao placar na hora). */
export const PTS = {
  /** Bumper; 2× com mais de uma bola na mesa e 2× na Onda Verde. */
  bumper: 100,
  /** 6ª batida no mesmo bumper (semáforo verde), fora da Onda Verde. */
  semaforoVerde: 500,
  /** Início da Onda Verde. */
  ondaVerde: 5000,
  /** Raia do topo apagada que acende. */
  raia: 100,
  /** As 3 raias acesas (multiplicador +1). */
  raias: 1000,
  /** Letra MOTOBOY nova / já acesa. */
  letraNova: 500,
  letraAcesa: 50,
  /** 7 letras: Multiball. */
  multiball: 2000,
  /** Bola capturada pelo Minhocão. */
  minhocao: 250,
  /** Prêmio "10000 pontos" do Minhocão. */
  premioPontos: 10000,
  /** Prêmio "letra" com todas as letras já acesas (não acontece na prática: as 7 disparam o Multiball). */
  premioLetraCheia: 3000,
  /** Meia volta do spinner. */
  spinner: 10,
  /** Chute do estilingue. */
  estilingue: 10,
} as const;

/** Quanto cada evento soma à base do bônus de fim de bola (multiplicada pelo multiplicador). */
export const BONUS_PTS = {
  bumper: 10,
  estilingue: 5,
  alvo: 100,
  raia: 50,
  minhocao: 100,
  /** Prêmio "bônus" do Minhocão. */
  premio: 2000,
} as const;

// ------------------------------------------------------------------ Minhocão
/** Ciclo de prêmios do Minhocão (começa num ponto sorteado; `extra` só uma vez por jogo). */
export const AWARDS = ['bonus', 'letra', 'saver', 'mult', 'pontos', 'letra', 'onda', 'extra'] as const;
/** Tempo (s) em que o buraco fica "entupido" depois de capturar (conta a partir da captura). */
export const KICKOUT_COOLDOWN = 4;
/** Acima desta velocidade (px/s) a bola passa direto pelo buraco. */
export const KICKOUT_MAX_SPEED = 700;
/** Velocidade (px/s) e ângulo (graus a partir da vertical, sorteado) da ejeção. */
export const KICK_EJECT_SPEED = 430;
export const KICK_EJECT_MIN_DEG = 25;
export const KICK_EJECT_RANGE_DEG = 30;

// ------------------------------------------------------------------ sacudir e lançador
/** Intervalo mínimo entre dois trancos (s). */
export const NUDGE_COOLDOWN = 0.18;
/** Quanto a conta de trancos cai por segundo (1 a cada 4 s). */
export const NUDGE_DECAY = 0.25;
/** Empurrão do tranco na bola (px/s): ±x (lado sorteado) e para cima. */
export const NUDGE_PUSH_X = 55;
export const NUDGE_PUSH_Y = 45;
/** Carga mínima (fração de 0 a 1) para o lançador disparar; abaixo disso a bola volta ao lugar. */
export const PLUNGER_MIN_CHARGE = 0.06;

// ------------------------------------------------------------------ física (limites)
/** Maior `dt` aceito por quadro (s): quadro maior é cortado. */
export const MAX_DT = 0.05;
/** Máximo de subpassos por quadro (o acumulador é zerado se sobrar mais que isso). */
export const MAX_SUBSTEPS = 40;
/** Velocidade mínima de impacto (px/s) para um alvo MOTOBOY contar. */
export const TARGET_MIN_HIT = 25;
/** Velocidade mínima de impacto (px/s) na face do estilingue para chutar, e intervalo entre chutes (s). */
export const SLING_MIN_HIT = 40;
export const SLING_COOLDOWN = 0.12;
