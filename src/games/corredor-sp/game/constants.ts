/** Resolução interna (ampliada pelo CSS com pixels nítidos). Era 320×200; dobrou para ver longe. */
export const W = 640;
export const H = 400;
/** Pixels de tela por pixel "de projeto": o HUD e as medidas antigas em 320×200 são multiplicados por isto. */
export const K = W / 320;

// ------------------------------------------------------------ pista pseudo-3D
/** Comprimento de um segmento de pista (unidades do mundo). */
export const SEG_LEN = 200;
/** Meia largura da pista (unidades). Posições laterais usam x normalizado: −1 borda esquerda, +1 direita. */
export const ROAD_W = 1000;
/** Câmera um pouco mais alta: a pista distante ocupa mais linhas da tela. */
export const CAM_H = 1150;
export const FOV = 100;
export const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
/** Distância da câmera ao jogador (o jogador fica na base da tela). */
export const PLAYER_Z = CAM_H * CAM_DEPTH;
/** Quantos segmentos são desenhados à frente. */
export const DRAW_DIST = 210;
/** Fração final da distância de desenho em que pista e objetos somem na névoa (sem "pipocar"). */
export const FOG_START = 0.72;
/** Largura mínima na tela (px internos) de veículos, itens e perigos distantes. */
export const MIN_OBJ_W = 8;
/** Segmentos por faixa de cor (zebra, grama, tracejado). */
export const BAND = 3;
/** Unidades do mundo por pixel de sprite: na distância do jogador o sprite sai no tamanho nativo. */
export const SPRITE_UNITS = 6.25;
/** Escala de desenho do jogador (maior que o resto, para leitura). */
export const PLAYER_DRAW_SCALE = 1.5;
/**
 * Quanto a curva empurra a moto para fora. É só um "peso" leve: numa curva forte, em velocidade
 * máxima, a moto escorrega uma faixa em uns 5 s se você não corrigir (com 0,12 era menos de 1 s e
 * parecia que a moto andava sozinha, já que o trânsito não escorrega).
 */
export const CENTRIFUGAL = 0.03;

/** km/h → unidades por segundo (1 m = 100 unidades; a faixa tem 500, uns 5 m: o mundo é um pouco "exagerado" para dar tempo de reagir). */
export const KMH = 100 / 3.6;

/** Unidades de pista por metro: 100 km/h = 27,8 m/s = 2778 unid./s. */
export const UNITS_PER_METER = 100;
/** Pontuação: 1 ponto por segundo na pista + 1 ponto a cada `METERS_PER_POINT` metros rodados (igual nas 3 categorias). */
export const METERS_PER_POINT = 10;

// ------------------------------------------------------------ faixas
/**
 * Centro das 4 faixas (x normalizado). A faixa da esquerda fica encostada na borda para abrir a
 * faixa azul: entre um carro na faixa 0 e outro na faixa 1 sobram 0,35 (a moto ocupa 0,10), contra
 * 0,25 dos outros corredores.
 */
export const LANES = [-0.85, -0.25, 0.25, 0.75];
/** Corredores entre as faixas; o primeiro é a faixa azul. */
export const CORRIDORS = [-0.55, 0, 0.5];
export const BLUE_LANE = -0.55;
/** Meia largura da pintura azul (x normalizado). */
export const BLUE_HALF = 0.075;
/** Distância do centro do corredor para contar como "andando no corredor". */
export const CORRIDOR_TOL = 0.1;

// ------------------------------------------------------------ jogador
export const PLAYER_HALF_W = 0.05;
export const PLAYER_LEN = 300;
export const OFFROAD_LIMIT = 1.25;
/** Fora do asfalto a velocidade máxima cai para esta fração. */
export const OFFROAD_SPEED = 0.35;
export const START_LIVES = 3;
export const MAX_LIVES = 10;
export const MAX_HELMETS = 3;
export const CRASH_TIME = 2;
export const INVULNERABLE_TIME = 3;

// ------------------------------------------------------------ grau e itens
export const GRAU_START = 0.3;
export const GRAU_DRAIN = 0.22;
export const GRAU_SPEED = 1.2;
export const GRAU_ACCEL = 1.3;
export const GRAU_STEER = 0.5;
export const GRAU_CHARGE_CORRIDOR = 0.08;
export const GRAU_CHARGE_BLUE = 0.14;
export const GRAU_ITEM = 0.5;
export const SPEED_ITEM_FACTOR = 1.15;
export const SPEED_ITEM_TIME = 8;
export const HELMET_SPEED = 6000;
export const HELMET_RANGE = 14000;

// ------------------------------------------------------------ progressão
export const LEVEL_TIME = 45;
export const DAY_CYCLE = 240;
export const SPAWN_AHEAD_MIN = 22000;
export const SPAWN_AHEAD_MAX = 36000;
export const DESPAWN_BEHIND = 3000;
/** Veículos à frente no início do turno; sobe em linha reta até `TRAFFIC_MAX` em `TRAFFIC_RAMP` s. */
export const TRAFFIC_START = 6;
export const TRAFFIC_MAX = 42;
export const TRAFFIC_RAMP = 360;
