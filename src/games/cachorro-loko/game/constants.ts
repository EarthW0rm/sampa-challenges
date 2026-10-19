/** Resolução nativa (o canvas é ampliado com pixels nítidos). */
export const W = 320;
export const H = 200;

/** Onde os pacotes se espatifam (topo do asfalto). */
export const GROUND_Y = 180;
/** Gravidade dos pacotes, em px/s². */
export const GRAVITY = 320;

export const BOX_SIZE = 12;

/** Quadro do cachorro: 40×40; a parte de baixo das rodas fica na linha 38. */
export const DOG_FRAME = 40;
export const DOG_WHEEL_ROW = 38;
export const DOG_BOTTOM = 190;
export const DOG_Y = DOG_BOTTOM - DOG_WHEEL_ROW;
export const DOG_MIN_X = -2;
export const DOG_MAX_X = W - DOG_FRAME + 2;
export const DOG_SPEED = 160;
export const DOG_TURBO_SPEED = 215;

/** Área do quadro (orientado para a direita) que pega pacotes. */
export const CATCH_RECT = { x: 1, y: 10, w: 34, h: 16 };
/** Quanto o grau levanta a área de pega. */
export const GRAU_LIFT = 10;
export const IMA_RANGE = 52;

export interface BeltDef {
  x0: number;
  x1: number;
  /** Linha de cima da esteira (onde o pacote apoia). */
  y: number;
  dir: 1 | -1;
}

/** Esteiras em zigue-zague: → ← → ←. A ponta de cada uma fica sobre a próxima. */
export const BELTS: BeltDef[] = [
  { x0: 166, x1: 250, y: 58, dir: 1 },
  { x0: 64, x1: 262, y: 84, dir: -1 },
  { x0: 52, x1: 270, y: 110, dir: 1 },
  { x0: 84, x1: 282, y: 136, dir: -1 },
];

export const RESTAURANT_POS = { x: 104, y: 2 };
export const CHEF_POS = { x: 126, y: 26 };
/** Boca de saída dos pacotes, embaixo do restaurante. */
export const SPAWN_POS = { x: 172, y: 40 };

export const START_LIVES = 3;
export const MAX_LIVES = 5;

export const POWER_DURATION = {
  turbo: 8,
  grau: 10,
  ima: 8,
  dobro: 10,
} as const;

export const BOMBS_FROM_SCORE = 15;
export const DIZZY_TIME = 1;
