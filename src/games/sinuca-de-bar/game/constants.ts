/**
 * Resolução lógica: posições, colisões e tamanhos ficam nesta grade de 320×200, a mesma em que o
 * fundo é desenhado (1×). O canvas tem W·SCALE × H·SCALE = 640×400 (padrão do hub); o fundo ganha o
 * dobro de detalhe com o Scale2x de `hires.ts` e as bolas já vêm em 2× nativo.
 */
export const W = 320;
export const H = 200;

// ---------------------------------------------------------------- mesa (igual ao gerador
// tools/pixelart/sinuca_de_bar.py: mudou aqui, mude lá e gere o fundo de novo)

/** Bordas do pano (onde as tabelas encostam). */
export const FELT_L = 16;
export const FELT_R = 304;
export const FELT_T = 40;
export const FELT_B = 184;
export const MID_X = (FELT_L + FELT_R) / 2;
export const CY = (FELT_T + FELT_B) / 2;
/** Linha de cabeceira (a branca da saída fica à esquerda dela) e marca do pé (ponta do triângulo). */
export const HEAD_X = FELT_L + 72;
export const FOOT_X = FELT_L + 216;
/** Caixas do placar no topo (x0, y0, x1, y1). */
export const BOX_L = [4, 2, 121, 25] as const;
export const BOX_R = [198, 2, 315, 25] as const;

/** Raio da bola (pixels lógicos); o PNG tem 16×16 (2× nativo). */
export const BALL_R = 4;
/** Distância da quina até onde a tabela começa (boca da caçapa de canto ≈ 2 bolas na diagonal). */
export const JAW_CORNER = 11;
/** Meia boca da caçapa do meio (boca ≈ 2,25 bolas). */
export const JAW_MID = 9;
/** Comprimento da quina cortada de cada boca, que guia a bola para dentro da caçapa. */
export const JAW_FACING = 5;
/** Caçapas: centro e raio de captura (o centro da bola dentro do raio = encaçapou). */
export const POCKETS: readonly { x: number; y: number; r: number }[] = [
  { x: FELT_L - 1, y: FELT_T - 1, r: 8.5 },
  { x: MID_X, y: FELT_T - 4, r: 7.5 },
  { x: FELT_R + 1, y: FELT_T - 1, r: 8.5 },
  { x: FELT_L - 1, y: FELT_B + 1, r: 8.5 },
  { x: MID_X, y: FELT_B + 4, r: 7.5 },
  { x: FELT_R + 1, y: FELT_B + 1, r: 8.5 },
];

// ---------------------------------------------------------------- física (game/physics.ts)

/** Passo fixo da simulação (s). O mesmo passo roda no jogo e na previsão da IA. */
export const PHYS_DT = 1 / 240;
/** Maior deslocamento de uma bola num subpasso (px): evita atravessar outra bola ou a tabela. */
export const MAX_SUBSTEP_MOVE = 0.5;
/** Velocidade da branca com força 100% (px/s). */
export const MAX_SPEED = 975;
/** Desaceleração constante do rolamento no pano (px/s²). */
export const ROLL_DECEL = 45;
/** Arrasto proporcional à velocidade (1/s): freia mais as bolas rápidas. */
export const LINEAR_DRAG = 0.2;
/** Abaixo disso a bola para (px/s). */
export const STOP_SPEED = 2;
/** Quanto da velocidade normal sobra no choque bola × bola e bola × tabela. */
export const BALL_RESTITUTION = 0.97;
export const CUSHION_RESTITUTION = 0.8;
/** Tempo máximo de uma tacada simulada (s): a IA não fica presa numa previsão. */
export const MAX_SHOT_TIME = 20;

// ---------------------------------------------------------------- interface

/** Força inicial da tacada (0–1) e passo das teclas ↑/↓. */
export const DEFAULT_POWER = 0.4;
export const POWER_STEP = 0.05;
/** Passo da mira nas teclas ←/→ e nos botões (graus); com Shift, o fino. */
export const AIM_STEP_DEG = 1;
export const AIM_FINE_DEG = 0.2;
/** Comprimento do taco (px) e recuo máximo na animação da tacada. */
export const CUE_LENGTH = 120;
export const CUE_PULL = 14;
/** Duração da animação da tacada (s) antes de a branca sair. */
export const STROKE_S = 0.16;
/** Tempo que um aviso fica na mesa (s). */
export const TOAST_S = 2.4;
/** Duração da bola sumindo na caçapa (s). */
export const SINK_S = 0.18;

// ---------------------------------------------------------------- computador (game/ai.ts)

/** Pausa antes de o computador mirar e tempo girando o taco até a mira escolhida (s). */
export const AI_THINK_S = 0.5;
export const AI_AIM_S = 0.8;
