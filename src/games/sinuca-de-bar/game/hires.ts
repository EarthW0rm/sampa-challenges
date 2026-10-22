/**
 * Visual em alta (640×400): a lógica do jogo continua em 320×200, mas o canvas tem o dobro de
 * pixels. Os PNGs (desenhados em 1×) ganham o dobro de detalhe com o Scale2x (EPX), que arredonda
 * curvas e diagonais sem criar cores novas. O desenho é feito com `ctx.setTransform(SCALE, …)` e
 * `blit()`, que coloca cada pixel do sprite em alta em um pixel da tela. As bolas já vêm em 2×
 * nativo (`isNativeHd`) e só são copiadas.
 */

import { isNativeHd } from './assets';

/** Pixels de tela por pixel lógico. */
export const SCALE = 2;

type Source = CanvasImageSource & { width: number; height: number };

/** Scale2x: cada pixel vira 2×2, copiando o vizinho quando há uma borda diagonal. */
export function scale2x(src: Source): HTMLCanvasElement {
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

function copyOf(src: Source): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

const cache = new WeakMap<object, unknown>();

/** Versão em alta de todos os sprites (mesmas chaves; calculada uma vez por conjunto de assets). */
export function upscaleAll<K extends string>(assets: Record<K, Source>): Record<K, HTMLCanvasElement> {
  const hit = cache.get(assets);
  if (hit) return hit as Record<K, HTMLCanvasElement>;
  const out = {} as Record<K, HTMLCanvasElement>;
  for (const k of Object.keys(assets) as K[]) out[k] = isNativeHd(k) ? copyOf(assets[k]) : scale2x(assets[k]);
  cache.set(assets, out);
  return out;
}

/** Desenha um sprite em alta no tamanho lógico (coordenadas em 320×200). */
export function blit(ctx: CanvasRenderingContext2D, img: Source, x: number, y: number) {
  ctx.drawImage(img, x, y, img.width / SCALE, img.height / SCALE);
}

/** Recorte de um sprite em alta; origem e tamanho em pixels lógicos. */
export function blitPart(
  ctx: CanvasRenderingContext2D,
  img: Source,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  ctx.drawImage(img, sx * SCALE, sy * SCALE, sw * SCALE, sh * SCALE, dx, dy, dw, dh);
}
