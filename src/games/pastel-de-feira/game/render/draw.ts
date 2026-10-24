import { drawPixelText, textWidth } from '../pixelFont';
import type { ItemId } from '../data/recipes';
import { ITEMS } from '../data/recipes';
import type { Profile } from '../types';
import type { Rect } from '../layout';

/** Paleta dos placeholders geométricos (a arte final troca isto na US-121). */
export const PAL = {
  ground: '#2b2433', wood: '#8a5a33', woodDark: '#5d3b21', panel: '#1f1829', panelLine: '#4a3d5e', tile: '#3a2f4a',
  tileHi: '#6a4f8f', text: '#f4efe2', muted: '#b9aecb', gold: '#ffd36b', red: '#d9503f', green: '#6fcf6f',
  blue: '#5aa7e8', orange: '#e8a13a', oil: '#c98a1e', shadow: '#1b1220',
} as const;

const FUR = ['#c9915a', '#8a5a33', '#e6d2a8', '#6b6b73', '#f0f0f0', '#3b2b22'];
export const furOf = (id: number): string => FUR[id % FUR.length];

export const PROFILE_COLOR: Readonly<Record<Profile, string>> = {
  economico: '#6fcf6f',
  padrao: '#5aa7e8',
  exigente: '#d9503f',
};

const ITEM_COLORS: Record<string, string> = {
  carne: '#b4412b', queijo: '#f2c14e', frango: '#e8d8a8', calabresa: '#c0502f', 'caldo-puro': '#9bd96b',
};
export function itemColor(id: ItemId): string {
  if (ITEM_COLORS[id]) return ITEM_COLORS[id];
  const it = ITEMS[id];
  if (it?.kind === 'bebida') return '#9bd96b';
  if (it?.kind === 'doce') return '#e58bb7';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 55%)`;
}

/** Nome curto (até 8 letras) para os botões do painel. */
export function shortName(id: ItemId): string {
  const n = ITEMS[id]?.name ?? id;
  return n.split(' ')[0].slice(0, 8);
}

export function box(ctx: CanvasRenderingContext2D, r: Rect, fill: string, line?: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
}

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, frac)))), h - 2);
}

export function textCenter(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, k = 1): void {
  drawPixelText(ctx, text, Math.round(cx - textWidth(text, k) / 2), y, color, k);
}

/** Cachorro de lado (placeholder): corpo, cabeça, orelha e rabo; `flip` espelha. Âncora: pé central. */
export function dog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fur: string,
  opts: { flip?: boolean; hat?: string; ribbon?: string; bob?: number } = {},
): void {
  const bob = Math.round(opts.bob ?? 0);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) + bob);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(-12, -1, 24, 3);
  ctx.fillStyle = fur;
  ctx.fillRect(-10, -20, 18, 14); // corpo
  ctx.fillRect(-9, -8, 4, 8); // pata
  ctx.fillRect(2, -8, 4, 8);
  ctx.fillRect(4, -30, 12, 12); // cabeça
  ctx.fillRect(-14, -22, 5, 3); // rabo
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(5, -34, 4, 7); // orelha
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(12, -26, 2, 2); // olho
  ctx.fillRect(15, -22, 2, 2); // focinho
  if (opts.ribbon) {
    ctx.fillStyle = opts.ribbon;
    ctx.fillRect(2, -19, 6, 3);
  }
  if (opts.hat) {
    ctx.fillStyle = opts.hat;
    ctx.fillRect(5, -38, 10, 5);
  }
  ctx.restore();
}
