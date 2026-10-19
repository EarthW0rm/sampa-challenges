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
