import { COLS, H, ROWS, TILE, W } from './constants';
import type { GameMap, Tile } from './maps';
import { drawPixelText } from './pixelFont';
import { SCALE } from './hires';

const cache = new Map<string, HTMLCanvasElement>();

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

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

const isRoadLike = (t: Tile | undefined) => t === '.' || t === 'f' || t === 'o' || t === 'b';
const isBuilding = (t: Tile | undefined) => t === '#' || t === 'g';

/** Pinta o mapa inteiro (visto de cima) numa camada pronta, no tamanho do canvas do jogo. */
export function renderMapArt(map: GameMap): HTMLCanvasElement {
  const hit = cache.get(map.id);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W * SCALE;
  c.height = H * SCALE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const r = rng(map.seed);
  const T = map.tiles;
  const at = (x: number, y: number): Tile | undefined => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? '#' : T[y][x]);
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const { palette: pal } = map;

  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 0, W, H);

  // quarteirões: cada conjunto de prédios ligados ganha uma cor de telhado
  const comp = new Int16Array(COLS * ROWS).fill(-1);
  let ncomp = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!isBuilding(T[y][x]) || comp[y * COLS + x] !== -1) continue;
      const stack = [[x, y]];
      comp[y * COLS + x] = ncomp;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || !isBuilding(T[ny][nx]) || comp[ny * COLS + nx] !== -1) continue;
          comp[ny * COLS + nx] = ncomp;
          stack.push([nx, ny]);
        }
      }
      ncomp++;
    }
  }
  const roofOf = Array.from({ length: ncomp }, () => pal.roofs[Math.floor(r() * pal.roofs.length)]);

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const t = T[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      switch (t) {
        case '#':
        case 'g': {
          const base = roofOf[comp[ty * COLS + tx]];
          rect(x, y, TILE, TILE, shade(base, 0.92 + r() * 0.16));
          // beirais claros nos lados que dão para a rua
          const edge = shade(base, 1.35);
          if (!isBuilding(at(tx, ty - 1))) rect(x, y, TILE, 2, edge);
          if (!isBuilding(at(tx - 1, ty))) rect(x, y, 2, TILE, edge);
          const dark = shade(base, 0.55);
          if (!isBuilding(at(tx, ty + 1))) rect(x, y + TILE - 2, TILE, 2, dark);
          if (!isBuilding(at(tx + 1, ty))) rect(x + TILE - 2, y, 2, TILE, dark);
          // detalhes de telhado
          const q = r();
          if (t === '#') {
            if (q < 0.3) {
              rect(x + 4 + Math.floor(r() * 4), y + 4 + Math.floor(r() * 4), 6, 5, shade(base, 1.25));
              rect(x + 5 + Math.floor(r() * 2), y + 5, 4, 1, shade(base, 0.6));
            } else if (q < 0.4) {
              ctx.fillStyle = shade(base, 0.7);
              ctx.beginPath();
              ctx.arc(x + 8, y + 8, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = shade(base, 1.3);
              ctx.fillRect(x + 6, y + 6, 2, 2);
            } else if (q < 0.5) {
              rect(x + 5, y + 5, 6, 6, '#7aa8d8');
              rect(x + 5, y + 5, 6, 1, '#b8d8f0');
            }
          } else {
            // garagem: portão de enrolar voltado para a rua
            let dx = 0;
            let dy = 0;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isRoadLike(at(tx + ax, ty + ay)) && at(tx + ax, ty + ay) !== 'b') { dx = ax; dy = ay; }
            rect(x + 1, y + 1, TILE - 2, TILE - 2, '#2a2438');
            const door = (px: number, py: number, w: number, h: number) => {
              rect(px, py, w, h, '#8d83a6');
              for (let i = 1; i < (w > h ? h : w); i += 2) {
                if (w > h) rect(px, py + i, w, 1, '#5e5870');
                else rect(px + i, py, 1, h, '#5e5870');
              }
            };
            if (dx === 1) door(x + 8, y + 3, 7, 10);
            else if (dx === -1) door(x + 1, y + 3, 7, 10);
            else if (dy === 1) door(x + 3, y + 8, 10, 7);
            else door(x + 3, y + 1, 10, 7);
            rect(x + 6, y + 6, 4, 4, '#5fd17a');
          }
          break;
        }
        case 'p': {
          rect(x, y, TILE, TILE, '#2f7a4a');
          for (let i = 0; i < 10; i++) rect(x + Math.floor(r() * 15), y + Math.floor(r() * 15), 1, 1, '#4a9a62');
          for (let i = 0; i < 2; i++) {
            const px = x + 4 + Math.floor(r() * 8);
            const py = y + 4 + Math.floor(r() * 8);
            ctx.fillStyle = '#1f5a38';
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a9a5a';
            ctx.beginPath();
            ctx.arc(px - 1, py - 1, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'w': {
          rect(x, y, TILE, TILE, '#244a7a');
          for (let i = 0; i < 3; i++) rect(x + Math.floor(r() * 10), y + 3 + i * 5, 5 + Math.floor(r() * 3), 1, '#3a6aa0');
          if (!(at(tx, ty - 1) === 'w' || at(tx, ty - 1) === '.')) rect(x, y, TILE, 2, '#1a3560');
          break;
        }
        case 'o': {
          const alt = (tx + ty) % 2 === 0;
          rect(x, y, TILE, TILE, alt ? '#6a647a' : '#5e5870');
          rect(x + 8, y, 8, 8, alt ? '#5e5870' : '#6a647a');
          rect(x, y + 8, 8, 8, alt ? '#5e5870' : '#6a647a');
          break;
        }
        case 'b': {
          rect(x, y, TILE, TILE, '#4a3f4a');
          for (let i = 0; i < TILE; i += 4) {
            rect(x, y + i, TILE, 1, '#5e5260');
            rect(x + i + ((i / 4) % 2) * 2, y, 1, TILE, '#5e5260');
          }
          for (let i = 0; i < 3; i++) rect(x + Math.floor(r() * 14), y + Math.floor(r() * 14), 2, 2, '#3a3040');
          const horizontal = isRoadLike(at(tx - 1, ty)) && isRoadLike(at(tx + 1, ty));
          if (horizontal) {
            rect(x, y, TILE, 2, '#2a2438');
            rect(x, y + TILE - 2, TILE, 2, '#2a2438');
          } else {
            rect(x, y, 2, TILE, '#2a2438');
            rect(x + TILE - 2, y, 2, TILE, '#2a2438');
          }
          break;
        }
        case '.':
        case 'f': {
          const fast = t === 'f';
          rect(x, y, TILE, TILE, fast ? pal.fast : pal.road);
          for (let i = 0; i < 6; i++) rect(x + Math.floor(r() * 15), y + Math.floor(r() * 15), 1, 1, fast ? '#3a4a6e' : '#352f48');
          const nL = isRoadLike(at(tx - 1, ty)) && at(tx - 1, ty) !== 'b';
          const nR = isRoadLike(at(tx + 1, ty)) && at(tx + 1, ty) !== 'b';
          const nU = isRoadLike(at(tx, ty - 1)) && at(tx, ty - 1) !== 'b';
          const nD = isRoadLike(at(tx, ty + 1)) && at(tx, ty + 1) !== 'b';
          const n = +nL + +nR + +nU + +nD;
          // calçada/meio-fio nos lados que encostam em prédio; guarda-corpo ao lado da água
          const side = (ax: number, ay: number, ox: number, oy: number, w: number, h: number) => {
            const nb = at(tx + ax, ty + ay);
            if (isBuilding(nb) || nb === 'p') rect(x + ox, y + oy, w, h, '#4a4262');
            else if (nb === 'w') {
              rect(x + ox, y + oy, w, h, '#c9c0d8');
            }
          };
          side(0, -1, 0, 0, TILE, 2);
          side(0, 1, 0, TILE - 2, TILE, 2);
          side(-1, 0, 0, 0, 2, TILE);
          side(1, 0, TILE - 2, 0, 2, TILE);
          if (fast) {
            const horiz = nL && nR;
            // divisória tracejada (entre as duas faixas) e setas de velocidade
            if (horiz && at(tx, ty + 1) === 'f') for (let i = 0; i < 2; i++) rect(x + 2 + i * 8, y + TILE - 1, 5, 2, '#9fb0d0');
            if (horiz && at(tx, ty - 1) === 'f' && at(tx, ty + 1) !== 'f') for (let i = 0; i < 2; i++) rect(x + 2 + i * 8, y, 5, 2, '#9fb0d0');
            if (horiz && (tx + (ty % 2)) % 4 === 0) {
              for (let k = 0; k < 2; k++) {
                rect(x + 3 + k * 5, y + 7, 3, 1, '#6a8ac0');
                rect(x + 5 + k * 5, y + 6, 1, 3, '#6a8ac0');
              }
            }
          } else if (n === 2 && nL && nR) {
            for (let i = 0; i < 2; i++) rect(x + 2 + i * 8, y + 7, 5, 2, '#5a4f2f');
          } else if (n === 2 && nU && nD) {
            for (let i = 0; i < 2; i++) rect(x + 7, y + 2 + i * 8, 2, 5, '#5a4f2f');
          }
          // faixa de pedestres ao lado de cruzamentos
          if (!fast && n === 2 && nL && nR && (at(tx - 1, ty) !== 'b') && [at(tx - 1, ty), at(tx + 1, ty)].some((_, k) => {
            const nx = tx + (k === 0 ? -1 : 1);
            const cnt = [at(nx - 1, ty), at(nx + 1, ty), at(nx, ty - 1), at(nx, ty + 1)].filter((q) => q === '.' || q === 'f').length;
            return cnt >= 3;
          })) {
            for (let i = 0; i < 4; i++) rect(x + 3, y + 3 + i * 3, 10, 1, '#8d83a6');
          }
          break;
        }
      }
    }
  }

  // sombras dos prédios sobre a rua (luz vindo do noroeste)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const t = T[ty][tx];
      if (t !== '.' && t !== 'f' && t !== 'o' && t !== 'b') continue;
      if (isBuilding(at(tx, ty - 1))) ctx.fillRect(tx * TILE, ty * TILE + 2, TILE, 3);
      if (isBuilding(at(tx - 1, ty))) ctx.fillRect(tx * TILE + 2, ty * TILE, 3, TILE);
    }
  }

  for (const l of map.labels) drawPixelText(ctx, l.text, l.tx * TILE + 2, l.ty * TILE + 5, l.color, 1, '#1b1220');

  cache.set(map.id, c);
  return c;
}

/** Desenha uma miniatura do mapa (para a tela de escolha). */
export function drawThumb(target: HTMLCanvasElement, map: GameMap) {
  const art = renderMapArt(map);
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(art, 0, 0, target.width, target.height);
}
