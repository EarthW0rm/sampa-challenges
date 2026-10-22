import { COLS, ROWS } from './constants';
import type { MapId, MoverClass } from './types';

/**
 * Tiles:  # prédio   . rua   f faixa rápida   b beco (só moto)   g garagem (esconderijo do cachorro)
 *         p parque/praça fechada   w água   o praça aberta (todos passam)
 */
export type Tile = '#' | '.' | 'f' | 'b' | 'g' | 'p' | 'w' | 'o';

export interface Label {
  text: string;
  /** Tile do canto esquerdo e linha de pixels dentro do tile. */
  tx: number;
  ty: number;
  color: string;
}

export interface GameMap {
  id: MapId;
  name: string;
  subtitle: string;
  blurb: string;
  accent: string;
  /** Paleta: asfalto, telhados (variações), calçada. */
  palette: { road: string; fast: string; roofs: string[]; curb: string; ground: string };
  tiles: Tile[][];
  start: { tx: number; ty: number };
  labels: Label[];
  /** Quadra de que a viatura sai quando não há onde nascer fora da vista. */
  seed: number;
}

const OPEN: Record<MoverClass, string> = {
  player: '.fbgo',
  moto: '.fbo',
  car: '.fo',
};

export function canEnter(map: GameMap, cls: MoverClass, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  return OPEN[cls].includes(map.tiles[ty][tx]);
}

// ------------------------------------------------------------------ construtor

class Builder {
  g: Tile[][];
  constructor() {
    this.g = Array.from({ length: ROWS }, () => Array<Tile>(COLS).fill('#'));
  }
  set(c: number, r: number, t: Tile) {
    if (c >= 0 && r >= 0 && c < COLS && r < ROWS) this.g[r][c] = t;
  }
  h(r: number, c0: number, c1: number, t: Tile = '.') {
    for (let c = c0; c <= c1; c++) this.set(c, r, t);
  }
  v(c: number, r0: number, r1: number, t: Tile = '.') {
    for (let r = r0; r <= r1; r++) this.set(c, r, t);
  }
  rect(c0: number, r0: number, c1: number, r1: number, t: Tile) {
    for (let r = r0; r <= r1; r++) this.h(r, c0, c1, t);
  }
}

/** Gerador simples e determinístico (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isRoad = (t: Tile | undefined) => t === '.' || t === 'f' || t === 'o';

/** Põe `count` garagens: prédios com exatamente uma rua colada (pontas sem saída), bem espalhadas. */
function autoGarages(b: Builder, count: number, seed: number, avoid: { tx: number; ty: number }) {
  const r = rng(seed);
  const cand: [number, number][] = [];
  for (let y = 2; y < ROWS - 2; y++) {
    for (let x = 2; x < COLS - 2; x++) {
      if (b.g[y][x] !== '#') continue;
      const nb = [b.g[y][x + 1], b.g[y][x - 1], b.g[y + 1][x], b.g[y - 1][x]];
      if (nb.filter(isRoad).length === 1 && nb.every((t) => t === '#' || isRoad(t)) && b.g[y][x] === '#') {
        // não encostar em outra garagem, beco ou água na diagonal
        const diag = [b.g[y + 1][x + 1], b.g[y + 1][x - 1], b.g[y - 1][x + 1], b.g[y - 1][x - 1]];
        if (diag.every((t) => t !== 'g' && t !== 'b' && t !== 'w')) cand.push([x, y]);
      }
    }
  }
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  const chosen: [number, number][] = [];
  for (const [x, y] of cand) {
    if (chosen.length >= count) break;
    if (Math.abs(x - avoid.tx) + Math.abs(y - avoid.ty) < 8) continue;
    if (chosen.some(([cx, cy]) => Math.abs(cx - x) + Math.abs(cy - y) < 9)) continue;
    chosen.push([x, y]);
  }
  for (const [x, y] of chosen) b.set(x, y, 'g');
}

// ------------------------------------------------------------------ mapas

function centro(): GameMap {
  const b = new Builder();
  const rows = [2, 6, 10, 14, 18, 22];
  const cols = [2, 7, 12, 17, 22, 27, 32, 37];
  for (const r of rows) b.h(r, 2, 37);
  for (const c of cols) b.v(c, 2, 22);
  // ruas tortas do centro velho: trechos fechados viram becos sem saída ou quarteirões maiores
  b.h(6, 8, 11, '#'); // quarteirão da Sé
  b.v(12, 7, 9, '#');
  b.h(10, 13, 16, '#');
  b.v(22, 11, 13, '#');
  b.h(14, 23, 26, '#');
  b.v(27, 15, 17, '#');
  b.h(18, 3, 6, '#');
  b.v(7, 19, 21, '#');
  b.v(32, 3, 5, '#');
  b.h(22, 28, 31, '#');
  // Praça da Sé: abre um miolo onde todos passam
  b.rect(13, 7, 16, 9, 'o');
  b.h(6, 12, 17); // e liga a praça pelo norte
  b.v(12, 6, 10);
  b.v(17, 6, 10);
  // becos (só moto): atravessam quarteirões
  b.v(9, 3, 5, 'b');
  b.v(24, 3, 5, 'b');
  b.h(16, 8, 11, 'b');
  b.v(34, 11, 13, 'b');
  b.h(20, 28, 31, 'b');
  b.v(19, 15, 17, 'b');
  autoGarages(b, 7, 11, { tx: 17, ty: 14 });
  return {
    id: 'centro',
    name: 'Centro Velho',
    subtitle: 'Sé · Anhangabaú',
    blurb: 'Ruas apertadas, quarteirões tortos, becos só para moto e garagens para sumir. O mapa mais difícil de ler.',
    accent: '#ff8a2a',
    palette: { road: '#2b2538', fast: '#34304a', roofs: ['#6b5a52', '#7a6558', '#5a4e5e', '#85705e', '#4e4a5c'], curb: '#8d83a6', ground: '#3a3150' },
    tiles: b.g,
    start: { tx: 17, ty: 14 },
    labels: [
      { text: 'PRACA DA SE', tx: 13, ty: 7, color: '#c9c0d8' },
      { text: 'R. 25 DE MARCO', tx: 3, ty: 22, color: '#8d83a6' },
    ],
    seed: 11,
  };
}

function paulista(): GameMap {
  const b = new Builder();
  const rows = [2, 7, 16, 22];
  const cols = [2, 7, 12, 17, 22, 27, 32, 37];
  for (const r of rows) b.h(r, 2, 37);
  for (const c of cols) b.v(c, 2, 22);
  // Avenida Paulista: duas faixas rápidas no meio do mapa
  b.h(11, 2, 37, 'f');
  b.h(12, 2, 37, 'f');
  // quarteirões da Consolação e dos Jardins: alguns trechos fechados, para quebrar a grade
  b.v(27, 3, 6, '#');
  b.h(16, 13, 16, '#');
  b.v(32, 17, 21, '#');
  b.v(7, 8, 10, '#');
  b.v(22, 17, 21, '#');
  // Parque Trianon (fechado) e vão livre do MASP (aberto)
  b.rect(8, 3, 11, 6, 'p');
  b.rect(18, 8, 21, 10, 'o');
  b.rect(18, 13, 21, 15, 'o');
  // becos entre as quadras
  b.v(9, 17, 21, 'b');
  b.v(29, 17, 21, 'b');
  b.v(34, 3, 6, 'b');
  b.h(4, 13, 16, 'b');
  b.h(9, 28, 31, 'b');
  b.h(14, 3, 6, 'b');
  autoGarages(b, 8, 29, { tx: 17, ty: 7 });
  return {
    id: 'paulista',
    name: 'Avenida Paulista',
    subtitle: 'Trianon · MASP · Consolação',
    blurb: 'A avenida larga no meio é uma faixa rápida: ótima para correr e perigosa para ser cercado. Praças abertas e becos nos quarteirões.',
    accent: '#ff4d5e',
    palette: { road: '#2a2a3c', fast: '#2f3a5a', roofs: ['#4e5a78', '#5a6a88', '#46506a', '#6a7090', '#3e4a66'], curb: '#9fb0d0', ground: '#33405a' },
    tiles: b.g,
    start: { tx: 17, ty: 7 },
    labels: [
      { text: 'AV PAULISTA', tx: 3, ty: 11, color: '#9fe0ff' },
      { text: 'MASP', tx: 19, ty: 9, color: '#ff4d5e' },
      { text: 'TRIANON', tx: 8, ty: 4, color: '#5fd17a' },
    ],
    seed: 29,
  };
}

function marginal(): GameMap {
  const b = new Builder();
  const cols = [2, 7, 12, 17, 22, 27, 32, 37];
  // margem norte e sul: avenidas rápidas (Marginal) e ruas
  b.h(2, 2, 37);
  b.h(22, 2, 37);
  for (const c of cols) {
    b.v(c, 2, 7);
    b.v(c, 17, 22);
  }
  b.h(4, 2, 37);
  b.h(20, 2, 37);
  for (const c of [5, 10, 15, 20, 25, 30, 35]) {
    b.v(c, 4, 7);
    b.v(c, 17, 20);
  }
  // as vias expressas (Marginal) por cima das transversais
  b.h(7, 2, 37, 'f');
  b.h(17, 2, 37, 'f');
  // fechamentos para quebrar a grade
  b.h(4, 8, 11, '#');
  b.h(4, 23, 26, '#');
  b.h(20, 13, 16, '#');
  b.h(20, 28, 31, '#');
  // o rio e as pontes
  b.rect(1, 9, 38, 15, 'w');
  for (const c of [9, 20, 31]) b.v(c, 8, 16, '.');
  // becos e garagens nas margens
  b.v(14, 3, 3, 'b');
  b.h(5, 33, 36, 'b');
  b.h(19, 8, 11, 'b');
  b.v(29, 18, 19, 'b');
  autoGarages(b, 8, 47, { tx: 20, ty: 7 });
  return {
    id: 'marginal',
    name: 'Marginal Pinheiros',
    subtitle: 'Rio · Pontes · Vias expressas',
    blurb: 'Duas vias expressas rápidas dos dois lados do rio e só três pontes para atravessar. Quem domina as pontes domina o mapa.',
    accent: '#5fd17a',
    palette: { road: '#2a2c38', fast: '#2c3a4e', roofs: ['#4a5a50', '#56664c', '#3e4e5a', '#60705c', '#46564e'], curb: '#a8c0a0', ground: '#2e3e3a' },
    tiles: b.g,
    start: { tx: 20, ty: 7 },
    labels: [
      { text: 'MARGINAL PINHEIROS', tx: 3, ty: 7, color: '#9fe0ff' },
      { text: 'RIO PINHEIROS', tx: 13, ty: 12, color: '#7aa8d8' },
      { text: 'MARGINAL PINHEIROS', tx: 3, ty: 17, color: '#9fe0ff' },
    ],
    seed: 47,
  };
}

export const MAPS: GameMap[] = [centro(), paulista(), marginal()];
export const mapById = (id: MapId): GameMap => MAPS.find((m) => m.id === id) ?? MAPS[0];

/** Mapa como texto (para depuração e testes). */
export function mapToText(m: GameMap): string {
  return m.tiles.map((r) => r.join('')).join('\n');
}
