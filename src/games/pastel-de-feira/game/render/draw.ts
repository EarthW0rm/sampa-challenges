import { drawPixelText, textWidth } from '../pixelFont';
import type { ItemId } from '../data/recipes';
import { ITEMS, itemLabel } from '../data/recipes';
import type { Profile } from '../types';
import type { Rect } from '../layout';
import { getAssets, LIB_PX, type Equipe, type Pose, type Aparencia } from '../assets';

/**
 * Paleta da barraca aconchegante (pixel art 16 bits, paleta quente, contorno marrom-escuro).
 * `text` é claro (sobre faixas vermelhas e o fogo); texto sobre pergaminho, placa e célula usa `ink`,
 * e o "sub" das células, `ink2`.
 */
export const PAL = {
  ground: '#e3dacb', wood: '#b47038', woodDark: '#7a4a22', panel: '#f6d9a0', panelLine: '#4a2a12', tile: '#ebc48a',
  tileHi: '#ffe3a8', text: '#fbf6e8', muted: '#6b4a2a', gold: '#f2c14e', red: '#d9503f', green: '#7bc043',
  blue: '#4f7bbf', orange: '#e0a23a', oil: '#d9961f', shadow: '#2e1c12',
  ink: '#2e1c12', ink2: '#6b4a2a', paper: '#fbf6e8', barBg: '#5a4430', dirt: '#a88a4a', cane: '#9bbf4a',
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

/** Nome curto (até 8 letras e único entre as receitas) para os botões do painel. */
export const shortName = (id: ItemId): string => itemLabel(id);

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
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.barBg;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, frac)))), h - 2);
}

/** Texto centrado em `cx`; texto escuro (`PAL.ink`, `PAL.ink2`) vai com `shadow = null`. */
export function textCenter(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, k = 1, shadow?: string | null): void {
  drawPixelText(ctx, text, Math.round(cx - textWidth(text, k) / 2), y, color, k, shadow);
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

/** Desenha um sprite 2× nativo com o pé central em (x, y); `flip` espelha. */
export function blitFeet(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, flip = false): void {
  const w = img.width / LIB_PX;
  const h = img.height / LIB_PX;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(27,18,32,0.35)';
  ctx.fillRect(-Math.round(w / 2) + 2, -1, Math.round(w) - 4, 3);
  ctx.drawImage(img, -Math.round(w / 2), -h, w, h);
  ctx.restore();
}

/** Cliente com a aparência sorteada; sem arte carregada cai no placeholder geométrico. */
export function drawCliente(ctx: CanvasRenderingContext2D, a: Aparencia, pose: Pose, x: number, y: number, o: { flip?: boolean; ribbon?: string; fallbackFur?: string } = {}): void {
  const img = getAssets()?.cliente(a.raca, a.porte, a.cor, pose);
  if (img) {
    blitFeet(ctx, img, x, y, o.flip);
    if (o.ribbon) {
      ctx.fillStyle = o.ribbon; // indicador fixo do perfil (RN-165)
      ctx.fillRect(Math.round(x) - 5, Math.round(y) - img.height / LIB_PX - 4, 10, 3);
    }
    return;
  }
  dog(ctx, x, y, o.fallbackFur ?? furOf(0), { flip: o.flip, ribbon: o.ribbon });
}

export function drawEquipe(ctx: CanvasRenderingContext2D, kind: Equipe, cor: string, pose: Pose, x: number, y: number, o: { flip?: boolean; bob?: number } = {}): void {
  const img = getAssets()?.equipe(kind, cor, pose);
  if (img) {
    blitFeet(ctx, img, x, y + Math.round(o.bob ?? 0), o.flip);
    return;
  }
  dog(ctx, x, y, cor, { flip: o.flip, hat: kind === 'func_fritador' ? PAL.red : kind === 'func_geral' ? PAL.blue : '#f4efe2', bob: o.bob });
}

export type PastelState = 'cru' | 'ponto' | 'passado' | 'queimado';

/** Categoria do sprite: caldo (copo), doce, Especial da Casa ou salgado comum. */
export function pastelCat(id: ItemId): 'copo' | 'doce' | 'especial' | 'salgado' {
  const it = ITEMS[id];
  if (it?.kind === 'bebida') return 'copo';
  if (it?.kind === 'doce') return 'doce';
  return it?.base === 'especial' ? 'especial' : 'salgado';
}

/** Pastel/caldo com a arte final em (x, y) (canto superior esquerdo), esticado em `w`×`h` lógicos. Devolve false sem arte (use o retângulo). */
export function drawPastel(ctx: CanvasRenderingContext2D, id: ItemId, state: PastelState, x: number, y: number, w: number, h: number): boolean {
  const cat = pastelCat(id);
  const img = getAssets()?.art(cat === 'copo' ? 'itens/copo' : `itens/pastel_${cat}_${state}`);
  if (!img) return false;
  ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  return true;
}

/** Selo do sabor (12×12 lógicos) com os pontinhos da versão (+1, +2). Devolve false sem arte (use `itemColor`). */
export function drawFlavor(ctx: CanvasRenderingContext2D, id: ItemId, x: number, y: number): boolean {
  const it = ITEMS[id];
  const key = it?.kind === 'bebida' ? id : (it?.base ?? id);
  if (!drawArt(ctx, `icones/sabor_${key}`, x, y)) return false;
  for (let i = 0; i < (it?.version ?? 0); i++) drawArt(ctx, 'ui/selo_versao', x - 2 + i * 4, y - 1);
  return true;
}

/** Pastel com o selo do sabor no canto superior direito (mesmo retângulo do `drawPastel`). `seal: false` só o pastel. */
export function drawPastelFlavor(ctx: CanvasRenderingContext2D, id: ItemId, state: PastelState, x: number, y: number, w: number, h: number, seal = true): boolean {
  const ok = drawPastel(ctx, id, state, x, y, w, h);
  if (ok && seal && pastelCat(id) !== 'copo') drawFlavor(ctx, id, x + w - 9, y - 4);
  return ok;
}

/** Imagem do jogo na posição (canto superior esquerdo) com o tamanho original em pixels lógicos. */
export function drawArt(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w?: number, h?: number): boolean {
  const img = getAssets()?.art(name);
  if (!img) return false;
  ctx.drawImage(img, Math.round(x), Math.round(y), w ?? img.width / LIB_PX, h ?? img.height / LIB_PX);
  return true;
}

/** Peça 3-slice `<nome>_esq|_meio|_dir` em `w` lógicos; o meio repete. */
export function drawThree(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number): boolean {
  const a = getAssets();
  const l = a?.art(`${name}_esq`);
  const m = a?.art(`${name}_meio`);
  const r = a?.art(`${name}_dir`);
  if (!l || !m || !r) return false;
  const lw = l.width / LIB_PX;
  const mw = m.width / LIB_PX;
  const rw = r.width / LIB_PX;
  const h = m.height / LIB_PX;
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  ctx.drawImage(l, x, y, lw, h);
  for (let cx = x + lw; cx < x + w - rw; cx += mw) {
    const cw = Math.min(mw, x + w - rw - cx);
    ctx.drawImage(m, 0, 0, cw * LIB_PX, m.height, cx, y, cw, h);
  }
  ctx.drawImage(r, x + w - rw, y, rw, h);
  return true;
}

/** 9-slice com cantos de `c` lógicos, esticado no retângulo. */
export function drawNine(ctx: CanvasRenderingContext2D, name: string, r: Rect, c: number): boolean {
  const img = getAssets()?.art(name);
  if (!img) return false;
  const k = LIB_PX;
  const iw = img.width / k;
  const ih = img.height / k;
  const s = c * k;
  const xs = [r.x, r.x + c, r.x + r.w - c];
  const ws = [c, r.w - 2 * c, c];
  const ys = [r.y, r.y + c, r.y + r.h - c];
  const hs = [c, r.h - 2 * c, c];
  const sx = [0, s, img.width - s];
  const sw = [s, (iw - 2 * c) * k, s];
  const sy = [0, s, img.height - s];
  const sh = [s, (ih - 2 * c) * k, s];
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      if (ws[i] > 0 && hs[j] > 0) ctx.drawImage(img, sx[i], sy[j], sw[i], sh[j], xs[i], ys[j], ws[i], hs[j]);
    }
  }
  return true;
}

/** Placa de madeira com o nome da zona (texto k=2 escuro). */
export function drawPlaque(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  const w = textWidth(label, 2) + 8;
  if (!drawThree(ctx, 'ui/placa', x, y, w)) box(ctx, { x, y, w, h: 15 }, '#e9a85a', PAL.ink);
  drawPixelText(ctx, label, x + 4, y + 3, PAL.ink, 2, null);
}
