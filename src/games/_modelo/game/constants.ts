/**
 * Resolução lógica: posições, colisões e tamanhos ficam nesta grade de 320×200, a mesma em que os
 * PNGs são desenhados (1×). O canvas tem W·SCALE × H·SCALE = 640×400 (padrão do hub) e os sprites
 * ganham o dobro de detalhe com o Scale2x de `hires.ts`.
 */
export const W = 320;
export const H = 200;

/** Velocidade do quadrado de exemplo (pixels lógicos por segundo). */
export const PLAYER_SPEED = 100;
export const PLAYER_SIZE = 8;
