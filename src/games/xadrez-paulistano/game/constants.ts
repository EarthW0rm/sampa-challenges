/**
 * Resolução lógica: posições e tamanhos ficam nesta grade de 320×200, a mesma em que os PNGs são
 * desenhados (1×). O canvas tem W·SCALE × H·SCALE = 640×400 (padrão do hub) e os sprites ganham o
 * dobro de detalhe com o Scale2x de `hires.ts`.
 */
export const W = 320;
export const H = 200;

// ---------------------------------------------------------------- layout (igual ao gerador
// tools/pixelart/xadrez_paulistano.py: mudou aqui, mude lá e gere o fundo de novo)

/** Canto superior esquerdo do tabuleiro e lado de cada casa. */
export const BOARD_X = 14;
export const BOARD_Y = 12;
export const SQ = 22;
/** Painel da direita: caixas dos dois lados e caixa de status. */
export const PANEL_X = 204;
export const PANEL_W = 110;
export const BOX_TOP_Y = 6;
export const BOX_BOTTOM_Y = 156;
export const BOX_H = 38;
export const STATUS_Y = 132;
export const STATUS_H = 20;
/** Peças capturadas por linha na caixa de cada lado. */
export const CAPTURED_PER_ROW = 9;

// ---------------------------------------------------------------- animação e interface

/** Duração da peça deslizando de uma casa para outra (s). */
export const MOVE_ANIM_S = 0.18;
/** Distância (pixels lógicos) que o ponteiro precisa andar para virar arrasto. */
export const DRAG_THRESHOLD = 3;
/** Tempo mínimo entre o lance do jogador e o do computador (ms), para dar para ver. */
export const AI_MIN_DELAY_MS = 450;

// ---------------------------------------------------------------- dificuldade (game/levels.ts)

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 100;
export const DEFAULT_LEVEL = 30;
/** Tempo de busca por lance: cresce com o quadrado do nível, de MIN (nível 1) a MAX (mestre). */
export const AI_TIME_MIN_MS = 200;
export const AI_TIME_MAX_MS = 3000;
/** Profundidade no mestre (na prática quem limita é o tempo). Nos outros níveis vai de 1 a 7. */
export const AI_DEPTH_MAX = 64;
/** Ruído na nota dos lances no nível 1 (centipeões); cai com o quadrado até zero no topo. */
export const AI_NOISE_MAX = 250;
/** Abaixo disso o ruído é desligado (busca exata e mais rápida). */
export const AI_NOISE_MIN = 5;
/** Chance de lance aleatório no nível 1; cai com o cubo até zero no mestre. */
export const AI_BLUNDER_MAX = 0.35;
/** Nível a partir do qual a busca olha as trocas até o fim (busca quiescente). */
export const AI_QUIESCENCE_FROM = 15;
/** Entradas da tabela de transposição (potência de 2). */
export const AI_TT_SIZE = 1 << 19;

// ---------------------------------------------------------------- testes de ponta a ponta

/**
 * Só nos testes (`isE2E()`): a busca do computador para em `tempo do nível × E2E_NODES_PER_MS` nós em vez
 * de pelo relógio, para os lances não dependerem da máquina. Calibrado em nós/ms medidos no nível 60
 * (registro da medição no CLAUDE.md do jogo).
 */
export const E2E_NODES_PER_MS = 400;
