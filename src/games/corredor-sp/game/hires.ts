/**
 * Sprites em alta: os PNGs do jogo são desenhados em 1× e aqui ganham o dobro de detalhe com o
 * Scale2x (EPX), que arredonda diagonais e curvas sem inventar cores novas. Os da biblioteca
 * compartilhada (cachorros, chaves `motos/…`) já são 2× nativos e só são copiados. Para longe, cada sprite tem
 * versões reduzidas (mipmaps) com média de cor e alfa binário: o carro distante vira uma silhueta
 * estável em vez de "piscar" pixels soltos ao se mexer.
 */
import { isNativeHd, recolored, type Assets } from './assets';

/** Quantas vezes o sprite em alta é maior que o PNG original. */
export const SPRITE_SCALE = 2;

type Img = HTMLCanvasElement;

/** Scale2x: cada pixel vira 2×2, copiando o vizinho quando há uma borda diagonal. */
function scale2x(src: CanvasImageSource & { width: number; height: number }): Img {
  const w = src.width;
  const h = src.height;
  const a = document.createElement('canvas');
  a.width = w;
  a.height = h;
  const actx = a.getContext('2d')!;
  actx.drawImage(src, 0, 0);
  const s = new Uint32Array(actx.getImageData(0, 0, w, h).data.buffer);
  const out = document.createElement('canvas');
  out.width = w * 2;
  out.height = h * 2;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(w * 2, h * 2);
  const o = new Uint32Array(od.data.buffer);
  const at = (x: number, y: number) => s[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const W2 = w * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      let e0 = P;
      let e1 = P;
      let e2 = P;
      let e3 = P;
      if (A !== D && C !== B) {
        if (C === A) e0 = A;
        if (A === B) e1 = B;
        if (D === C) e2 = C;
        if (B === D) e3 = D;
      }
      const i = y * 2 * W2 + x * 2;
      o[i] = e0;
      o[i + 1] = e1;
      o[i + W2] = e2;
      o[i + W2 + 1] = e3;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

function copyOf(src: CanvasImageSource & { width: number; height: number }): Img {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** Metade do tamanho, com média de cor e alfa cortado em 50% (borda dura de pixel art). */
function half(src: Img): Img {
  const w = Math.max(1, Math.ceil(src.width / 2));
  const h = Math.max(1, Math.ceil(src.height / 2));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] >= 110) {
      // o canvas guarda cor pré-multiplicada: desfaz para não escurecer as bordas
      const k = 255 / d[i];
      d[i - 3] = Math.min(255, d[i - 3] * k);
      d[i - 2] = Math.min(255, d[i - 2] * k);
      d[i - 1] = Math.min(255, d[i - 1] * k);
      d[i] = 255;
    } else d[i] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

interface Entry {
  /** Níveis: 0 = alta (2×), 1 = 1×, 2 = ½, 3 = ¼ … */
  levels: Img[];
}

const cache = new Map<string, Entry>();

function entry(assets: Assets, key: string): Entry {
  let e = cache.get(key);
  if (e) return e;
  const bar = key.indexOf('|');
  const base = bar >= 0 ? recolored(assets, key.slice(0, bar), key.slice(bar + 1)) : assets[key];
  if (!base) throw new Error(`Asset não encontrado: ${key}`);
  // sprites da biblioteca já são 2× nativos: entram como estão (o resto passa pelo Scale2x)
  const levels = [isNativeHd(bar >= 0 ? key.slice(0, bar) : key) ? copyOf(base) : scale2x(base)];
  while (levels.length < 6 && levels[levels.length - 1].width > 4) levels.push(half(levels[levels.length - 1]));
  e = { levels };
  cache.set(key, e);
  return e;
}

/** Sprite em alta (2×). `key` pode ter `|#cor` para motos pintadas. */
export function hires(assets: Assets, key: string): Img {
  return entry(assets, key).levels[0];
}

/** Melhor nível para desenhar com `drawW` pixels de largura (o menor que ainda é ≥ drawW). */
export function mip(assets: Assets, key: string, drawW: number): Img {
  const { levels } = entry(assets, key);
  let i = 0;
  while (i + 1 < levels.length && levels[i + 1].width >= drawW) i++;
  return levels[i];
}

/** Gera tudo de antemão para não engasgar no primeiro quadro em que o sprite aparece. */
export function warmUp(assets: Assets, keys: string[]) {
  for (const k of keys) entry(assets, k);
}
