/** Campo lógico 640×400 = grade de 40×25 tiles de 16 px; o canvas é desenhado em W·SCALE × H·SCALE. */
export const TILE = 16;
export const COLS = 40;
export const ROWS = 25;
export const W = COLS * TILE;
export const H = ROWS * TILE;

// ------------------------------------------------------------------ velocidades (px/s)
/** Moto do cachorro. */
export const PLAYER_SPEED = 84;
export const TURBO_MULT = 1.38;
/** Faixas rápidas (Marginal, Paulista): todo mundo anda mais rápido nelas. */
export const FAST_LANE_MULT = 1.22;
/** Entrega pesada deixa a moto mais lenta. */
export const HEAVY_MULT = 0.86;
/** Carro e moto da Rocam: velocidade base e quanto cada estrela soma (fração). */
export const CAR_SPEED = 70;
export const MOTO_SPEED = 80;
export const COP_STAR_BONUS = 0.035;
export const HELI_SPEED = 46;

// ------------------------------------------------------------------ turbo
export const TURBO_DRAIN = 0.42;
export const TURBO_RECHARGE = 0.1;
/** Depois de zerar, só volta a ligar com este tanto. */
export const TURBO_MIN_RESTART = 0.25;
export const TURBO_ITEM = 0.55;

// ------------------------------------------------------------------ jogador
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const CATCH_DIST = 11;
export const INVULN_TIME = 2.5;
export const HIDE_MAX = 4;
export const GARAGE_COOLDOWN = 6;
/** Folga (px) para fazer a curva um pouco antes do centro da esquina. */
export const TURN_TOLERANCE = 5;

// ------------------------------------------------------------------ procurado
export const HEAT_MAX = 100;
export const HEAT_PER_STAR = 20;
export const HEAT_DELIVERY = 16;
/** Pontos de calor por segundo: visto, escondido na garagem e fora de vista. */
export const HEAT_SEEN = 2.4;
export const HEAT_COOL = 3.2;
export const HEAT_COOL_HIDDEN = 10;
/** Distância (em tiles de caminho) em que uma viatura enxerga o cachorro. */
export const SIGHT_TILES = 9;
export const RADIO_MEMORY = 9;

// ------------------------------------------------------------------ itens / óleo
export const OIL_TIME = 22;
export const OIL_STUN = 2.6;
export const MAX_ITEMS = 3;
export const ITEM_INTERVAL = 9;
export const ITEM_LIFETIME = 28;
export const SHIELD_STUN = 1.6;

// ------------------------------------------------------------------ pedidos
/** Alcance (px) da coleta e da entrega. */
export const JOB_RADIUS = 9;
/** Distância de caminho (tiles) do cachorro à coleta e da coleta à entrega: [mínimo, máximo]. */
export const JOB_PICKUP_DIST = [12, 40] as const;
export const JOB_DROP_DIST = [20, 60] as const;
/** Próximo pedido depois de entregar / de perder o urgente (s). */
export const NEXT_JOB_DELAY = 1.2;
export const LATE_JOB_DELAY = 1.5;
/** A partir de quantas entregas cada tipo entra no sorteio. */
export const JOB_UNLOCK = { fragil: 2, urgente: 3, pesado: 4 } as const;
/** Prazo do urgente: max(URGENT_MIN, tiles·TILE/PLAYER_SPEED·URGENT_FACTOR + URGENT_EXTRA) s. */
export const URGENT_MIN = 10;
export const URGENT_FACTOR = 1.4;
export const URGENT_EXTRA = 8;
/** Calor somado ao perder o urgente / extra da entrega pesada. */
export const LATE_HEAT = 8;
export const HEAVY_HEAT = 8;
/** Pontos extras por estrela acima de 1 (fração dos pontos-base). */
export const STAR_POINTS = 0.25;

// ------------------------------------------------------------------ óleo, itens e captura (complemento)
export const OIL_START = 1;
export const OIL_MAX = 3;
/** Onde a mancha cai (px atrás da moto) e o alcance da derrapada (px). */
export const OIL_BACK = 6;
export const OIL_RADIUS = 10;
/** Primeiro item (s), distância mínima de caminho ao cachorro (tiles) e alcance para pegar (px). */
export const ITEM_FIRST = ITEM_INTERVAL * 0.5;
export const ITEM_MIN_DIST = 6;
export const ITEM_RADIUS = 10;
/** Invulnerável depois do capacete (s). */
export const SHIELD_INVULN = 1;
/** Duração do PEGO! (s) e fração do calor que fica depois de ser pego. */
export const CAUGHT_PAUSE = 1.5;
export const CATCH_HEAT_KEEP = 0.5;
/** Espera até a primeira viatura no começo e depois de ser pego (s). */
export const SPAWN_FIRST = 1;
export const SPAWN_AFTER_CATCH = 2;
/** Teto do passo do motor por quadro (s). */
export const DT_MAX = 0.05;

// ------------------------------------------------------------------ pontos
export const POINTS = { normal: 100, fragil: 200, urgente: 250, pesado: 300 } as const;
export const PIZZA_POINTS = 150;
export const TIME_BONUS_PER_SEC = 12;
