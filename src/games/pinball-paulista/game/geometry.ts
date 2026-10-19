/** Espelho em torno do centro do campo (x = 111): as duas metades da mesa são simétricas. */
export const mx = (x: number) => 222 - x;

export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}
const seg = (ax: number, ay: number, bx: number, by: number): Seg => ({ ax, ay, bx, by });
const both = (ax: number, ay: number, bx: number, by: number): Seg[] => [seg(ax, ay, bx, by), seg(mx(ax), ay, mx(bx), by)];

/** Paredes fixas (bola quica). Linhas sem espessura; o desenho dá a espessura visual. */
export const WALLS: Seg[] = [];

// parede esquerda, parede interna da rampa e parede externa direita
WALLS.push(seg(8, 130, 8, 420));
WALLS.push(seg(214, 100, 214, 420));
WALLS.push(seg(232, 130, 232, 420));
// piso da rampa de lançamento
WALLS.push(seg(214, 396, 232, 396));

// arco superior: elipse de centro (120,130), raios 112 × 120, da esquerda para a direita
export const ARCH: [number, number][] = [];
for (let i = 0; i <= 32; i++) {
  const a = Math.PI - (i / 32) * Math.PI;
  ARCH.push([120 + 112 * Math.cos(a), 130 - 120 * Math.sin(a)]);
}
for (let i = 0; i < ARCH.length - 1; i++) WALLS.push(seg(ARCH[i][0], ARCH[i][1], ARCH[i + 1][0], ARCH[i + 1][1]));

// separadores das 3 raias do topo (semáforo)
export const LANE_SEPARATORS_X = [62, 95, 128, 161];
for (const x of LANE_SEPARATORS_X) WALLS.push(seg(x, 44, x, 70));

// guias dos corredores laterais (faixa azul) e pés
WALLS.push(...both(28, 128, 28, 184));
// fundo inclinado dos corredores: leva a bola para dentro da mesa (nunca para a canaleta)
WALLS.push(...both(8, 194, 34, 206));
// trilhos das saídas laterais e guias das entradas dos flippers
WALLS.push(...both(22, 296, 22, 330));
WALLS.push(...both(22, 330, 70, 345));

/** Portão de mão única na saída da rampa: só barra a bola que vem do campo (centro à esquerda de x = 214). */
export const GATE: Seg = seg(214, 66, 214, 100);

/** Pinos redondos (bola quica) — ponta das guias. */
export const POSTS: { x: number; y: number; r: number }[] = [
  ...[62, 95, 128, 161].map((x) => ({ x, y: 70, r: 2.5 })),
  { x: 28, y: 184, r: 3 },
  { x: mx(28), y: 184, r: 3 },
  { x: 22, y: 296, r: 3 },
  { x: mx(22), y: 296, r: 3 },
];

/** Bumpers (semáforos). */
export const BUMPERS: { x: number; y: number }[] = [
  { x: 84, y: 146 },
  { x: 138, y: 146 },
  { x: 111, y: 186 },
];

/** Estilingues: a face que chuta é a, c (a = topo, c = ponta de baixo). */
export interface Sling {
  a: [number, number];
  b: [number, number];
  c: [number, number];
  side: 'L' | 'R';
}
export const SLINGS: Sling[] = [
  { a: [38, 268], b: [38, 312], c: [62, 322], side: 'L' },
  { a: [mx(38), 268], b: [mx(38), 312], c: [mx(62), 322], side: 'R' },
];

/** Alvos MOTOBOY: placas nas faces internas das guias dos corredores (os bumpers jogam a bola nelas). */
export interface Target {
  id: number;
  letter: string;
  seg: Seg;
  /** Canto superior esquerdo da placa desenhada. */
  px: number;
  py: number;
  /** Lado do campo onde a bola precisa estar para valer (+1 = bola à direita da parede, -1 = à esquerda). */
  nx: 1 | -1;
}
export const TARGETS: Target[] = [
  { id: 0, letter: 'M', seg: seg(28, 130, 28, 142), px: 29, py: 130, nx: 1 },
  { id: 1, letter: 'O', seg: seg(28, 146, 28, 158), px: 29, py: 146, nx: 1 },
  { id: 2, letter: 'T', seg: seg(28, 162, 28, 174), px: 29, py: 162, nx: 1 },
  { id: 3, letter: 'O', seg: seg(194, 124, 194, 136), px: 189, py: 124, nx: -1 },
  { id: 4, letter: 'B', seg: seg(194, 140, 194, 152), px: 189, py: 140, nx: -1 },
  { id: 5, letter: 'O', seg: seg(194, 156, 194, 168), px: 189, py: 156, nx: -1 },
  { id: 6, letter: 'Y', seg: seg(194, 172, 194, 184), px: 189, py: 172, nx: -1 },
];

/** Raias do topo: sensores. */
export const ROLLOVERS = [
  { x: 78.5, y: 58 },
  { x: 111.5, y: 58 },
  { x: 144.5, y: 58 },
];

/** Spinners (rodas) nos corredores laterais. */
export const SPINNERS = [
  { x: 18, y: 160, w: 16, side: 'L' as const },
  { x: mx(18), y: 160, w: 16, side: 'R' as const },
];

