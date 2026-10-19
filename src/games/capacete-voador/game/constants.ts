import type { Rect } from './types';

/** Campo lógico 640×400 (a tela do QBasic original); o canvas é desenhado em W·SCALE × H·SCALE. */
export const W = 640;
export const H = 400;

/** Física em "unidades QBasic" (tela de 640 px): 1 unidade = 1 pixel lógico. */
export const POS_SCALE = 1;
/** Passo fixo de simulação (unidades de tempo do QBasic). */
export const DT = 0.05;
/** Substeps por segundo real: 120 × 0,05 = 6 unidades de tempo por segundo. */
export const SUBSTEPS_PER_SECOND = 120;
/** Tempo máximo de voo antes de desistir do projétil. */
export const MAX_FLIGHT_T = 80;

/** Quadro do motoboy (40×40); a parte de baixo das rodas fica na linha 38. */
export const RIDER_SIZE = 40;
export const RIDER_WHEEL_ROW = 38;
/**
 * Áreas de acerto no quadro virado para a direita (espelhadas para o jogador 2).
 * O piloto é só a cabeça: acertar nele é difícil de propósito, porque vence a rodada na hora.
 */
export const PILOT_BOX: Rect = { x: 19, y: 9, w: 10, h: 8 };
export const MOTO_BOX: Rect = { x: 1, y: 17, w: 33, h: 22 };
/** Acertos na moto até ela ser destruída. */
export const MOTO_HP = 3;
export const SUN_POS = { x: 308, y: 4 };
export const SUN_RECT: Rect = { x: 310, y: 6, w: 20, h: 20 };

export const CRATER_RADIUS = 6;
export const DESTROY_CRATER_RADIUS = 12;

export const ANGLE_MIN = 0;
export const ANGLE_MAX = 180;
export const VELOCITY_MIN = 1;
export const VELOCITY_MAX = 200;

export const DEFAULT_GRAVITY = 9.8;
