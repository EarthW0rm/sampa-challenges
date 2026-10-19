import type { Assets } from './assets';
import { SCALE, upscaleAll } from './hires';
import { H, RIDER_SIZE, RIDER_WHEEL_ROW, W } from './constants';
import type { Point } from './types';

export interface BuildingType {
  key: string;
  name: string;
  width: number;
  /** Altura de um andar (px). */
  floorH: number;
  topH: number;
  baseH: number;
  /** Linha (a partir do topo da imagem) onde a moto apoia. */
  roof: number;
  /** Ciclo de padrões dos andares (Copan ondula a cada 6 andares). */
  cycle: number;
  /** Prédios de altura fixa (MASP). */
  fixedH?: number;
  /** Pode receber um motoboy no telhado? */
  flat: boolean;
}

export const BUILDING_TYPES: BuildingType[] = [
  { key: 'copan', name: 'Edifício Copan', width: 48, floorH: 3, topH: 6, baseH: 8, roof: 3, cycle: 6, flat: true },
  { key: 'italia', name: 'Edifício Itália', width: 36, floorH: 4, topH: 9, baseH: 6, roof: 5, cycle: 1, flat: true },
  { key: 'banespa', name: 'Edifício Altino Arantes', width: 40, floorH: 4, topH: 27, baseH: 6, roof: 5, cycle: 1, flat: false },
  { key: 'martinelli', name: 'Edifício Martinelli', width: 40, floorH: 5, topH: 11, baseH: 7, roof: 0, cycle: 1, flat: false },
  { key: 'predinho', name: 'Predinho pichado', width: 32, floorH: 5, topH: 14, baseH: 6, roof: 6, cycle: 1, flat: true },
  { key: 'farialima', name: 'Torre Faria Lima', width: 36, floorH: 3, topH: 6, baseH: 6, roof: 3, cycle: 1, flat: true },
  { key: 'masp', name: 'MASP', width: 56, floorH: 0, topH: 0, baseH: 0, roof: 0, cycle: 1, fixedH: 30, flat: true },
];

const STRIP_FLOORS = 12;

export interface PlacedBuilding {
  type: BuildingType;
  x: number;
  height: number;
  floors: number;
  /** Corta a largura desenhada (prédio do meio encostado nos da direita). */
  clipRight?: number;
}

export interface City {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** 1 = pixel sólido de prédio. */
  mask: Uint8Array;
  buildings: PlacedBuilding[];
  /** Posição (canto superior esquerdo do quadro 40×40) dos dois motoboys. */
  riders: [Point, Point];
}

type Rng = () => number;
const pick = <T,>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)];
const randInt = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

function makeBuilding(rng: Rng, type: BuildingType, x: number, minH: number, maxH: number): PlacedBuilding {
  if (type.fixedH) return { type, x, height: type.fixedH, floors: 0 };
  const target = randInt(rng, minH, maxH);
  const floors = Math.max(2, Math.round((target - type.topH - type.baseH) / type.floorH));
  return { type, x, floors, height: type.topH + type.baseH + floors * type.floorH };
}

/** Faixas onde cada motoboy pode aparecer (centro do prédio, em px) e distância mínima entre eles. */
const ZONE_P1: [number, number] = [28, 230];
const ZONE_P2: [number, number] = [W - 230, W - 28];
const MIN_RIDER_GAP = 260;
/** Um vizinho mais alto que o telhado do motoboy por mais que isso o deixaria encurralado. */
const MAX_NEIGHBOR_RISE = 110;

interface Layout {
  buildings: PlacedBuilding[];
  /** Índices (em `buildings`) dos prédios onde os motoboys aparecem. */
  slots: [number, number];
}

function layoutCity(rng: Rng): Layout {
  const types = BUILDING_TYPES;
  const anyNoMasp = types.filter((t) => !t.fixedH);
  // a moto tem ~33 px: só prédios de telhado reto com 36 px ou mais
  const canHost = (b: PlacedBuilding, i: number, all: PlacedBuilding[]) => {
    const t = b.type;
    if (!t.flat || t.fixedH || t.width < 36 || b.clipRight !== undefined || b.height < 60) return false;
    return [all[i - 1], all[i + 1]].every((n) => !n || n.height - b.height <= MAX_NEIGHBOR_RISE);
  };
  const center = (b: PlacedBuilding) => b.x + b.type.width / 2;

  for (let attempt = 0; attempt < 200; attempt++) {
    const buildings: PlacedBuilding[] = [];
    let x = 0;
    let maspUsed = false;
    while (x < W) {
      let t = pick(rng, types);
      if (t.fixedH && (maspUsed || rng() < 0.6)) t = pick(rng, anyNoMasp);
      if (t.fixedH) maspUsed = true;
      const b = makeBuilding(rng, t, x, 60, 270);
      if (x + t.width > W) b.clipRight = W - x;
      buildings.push(b);
      x += t.width;
    }
    // Evita uma fatia minúscula na borda direita.
    const last = buildings[buildings.length - 1];
    if (last.clipRight !== undefined && last.clipRight < 12) continue;

    const inZone = (b: PlacedBuilding, z: [number, number]) => center(b) >= z[0] && center(b) <= z[1];
    const c1 = buildings.map((_b, i) => i).filter((i) => canHost(buildings[i], i, buildings) && inZone(buildings[i], ZONE_P1));
    const c2 = buildings.map((_b, i) => i).filter((i) => canHost(buildings[i], i, buildings) && inZone(buildings[i], ZONE_P2));
    if (!c1.length || !c2.length) continue;
    const i1 = pick(rng, c1);
    const ok2 = c2.filter((j) => center(buildings[j]) - center(buildings[i1]) >= MIN_RIDER_GAP);
    if (!ok2.length) continue;
    return { buildings, slots: [i1, pick(rng, ok2)] };
  }
  throw new Error('Falha ao gerar a cidade');
}

type Source = CanvasImageSource & { width: number; height: number };

/**
 * Desenha um prédio. `k` = pixels do canvas por pixel lógico: a máscara de colisão usa 1 (sprites
 * originais) e o visual usa SCALE (sprites em alta). Os andares sorteados vêm prontos em `floorIdx`
 * para os dois desenhos saírem iguais.
 */
function drawBuilding(ctx: CanvasRenderingContext2D, assets: Record<string, Source>, b: PlacedBuilding, floorIdx: number[], k: number) {
  const t = b.type;
  const y0 = H - b.height;
  const put = (img: Source, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) =>
    ctx.drawImage(img, sx * k, sy * k, sw * k, sh * k, dx, dy, sw, sh);
  const whole = (img: Source, dx: number, dy: number) => put(img, 0, 0, img.width / k, img.height / k, dx, dy);
  ctx.save();
  if (b.clipRight !== undefined) {
    ctx.beginPath();
    ctx.rect(b.x, 0, b.clipRight, H);
    ctx.clip();
  }
  if (t.fixedH) {
    whole(assets[t.key], b.x, y0);
  } else {
    whole(assets[`${t.key}_topo`], b.x, y0);
    const strip = assets[`${t.key}_andares`];
    floorIdx.forEach((idx, i) => put(strip, 0, idx * t.floorH, t.width, t.floorH, b.x, y0 + t.topH + i * t.floorH));
    whole(assets[`${t.key}_base`], b.x, y0 + t.topH + b.floors * t.floorH);
  }
  ctx.restore();
}

function pickFloors(b: PlacedBuilding, rng: Rng): number[] {
  const t = b.type;
  if (t.fixedH) return [];
  const reps = STRIP_FLOORS / t.cycle;
  const out: number[] = [];
  for (let i = 0; i < b.floors; i++) out.push(t.cycle > 1 ? (i % t.cycle) + t.cycle * Math.floor(rng() * reps) : Math.floor(rng() * STRIP_FLOORS));
  return out;
}

export function generateCity(assets: Assets, rng: Rng = Math.random): City {
  const { buildings, slots } = layoutCity(rng);
  const floors = buildings.map((b) => pickFloors(b, rng));
  const hi = upscaleAll(assets);

  // visual em alta
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);
  buildings.forEach((b, i) => drawBuilding(ctx, hi, b, floors[i], SCALE));
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // máscara de colisão em resolução lógica, a partir dos sprites originais
  const lo = document.createElement('canvas');
  lo.width = W;
  lo.height = H;
  const lctx = lo.getContext('2d', { willReadFrequently: true })!;
  lctx.imageSmoothingEnabled = false;
  buildings.forEach((b, i) => drawBuilding(lctx, assets, b, floors[i], 1));
  const data = lctx.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;

  const slot = (b: PlacedBuilding): Point => ({
    x: b.x + Math.floor(b.type.width / 2) - RIDER_SIZE / 2,
    y: H - b.height + b.type.roof - RIDER_WHEEL_ROW - 1,
  });
  return { canvas, ctx, mask, buildings, riders: [slot(buildings[slots[0]]), slot(buildings[slots[1]])] };
}

/** Abre uma cratera circular no prédio (canvas + máscara de colisão). */
export function applyCrater(city: City, cx: number, cy: number, r: number) {
  const { ctx, mask } = city;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  // máscara (resolução lógica)
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
    const y = y0 + dy;
    if (y < 0 || y >= H) continue;
    const xa = Math.max(0, x0 - half);
    const xb = Math.min(W - 1, x0 + half);
    if (xb < xa) continue;
    mask.fill(0, y * W + xa, y * W + xb + 1);
  }
  // visual (em alta): o mesmo círculo com o dobro de resolução, borda mais redonda
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  const R = r * SCALE;
  const X0 = x0 * SCALE + SCALE / 2;
  const Y0 = y0 * SCALE + SCALE / 2;
  for (let dy = -R - 1; dy <= R; dy++) {
    const yy = dy + 0.5;
    const half = Math.sqrt(Math.max(0, (R + 0.6) * (R + 0.6) - yy * yy));
    if (half <= 0) continue;
    ctx.fillRect(Math.round(X0 - half), Y0 + dy, Math.round(X0 + half) - Math.round(X0 - half), 1);
  }
  ctx.restore();
}
