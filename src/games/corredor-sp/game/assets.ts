/**
 * Carrega os PNGs da pasta assets e os cachorros da biblioteca compartilhada (src/shared/sprites),
 * e troca a cor-chave das motos.
 *
 * Itens (`itens/…`) vêm de `lib/itens/pickup_*` e `lib/capacete/p1_*`, também em alta.
 * Os cachorros de costas (`caes_costas/<raça>_<categoria>_<pose>`) já vêm em alta definição (80×88,
 * o dobro do tamanho lógico 40×44). O jogo continua chamando-os de `motos/<raça>_<categoria>_<pose>`:
 * é um apelido criado em `loadAssets`. Chaves `motos/…` NÃO passam pelo Scale2x (ver `game/hires.ts`).
 */
import { loadLibrary } from '../../../shared/sprites';

const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

export type Assets = Record<string, HTMLImageElement>;

/** Chave = caminho sem extensão dentro de assets/ (ex.: "motos/caramelo_150_reto"). */
const keyOf = (path: string) => path.replace('../assets/', '').replace(/\.png$/, '');

export function assetUrl(key: string): string {
  const url = URLS[`../assets/${key}.png`];
  if (!url) throw new Error(`Asset não encontrado: ${key}`);
  return url;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
    img.src = src;
  });
}

/** Chaves de sprites já em alta definição (apelidos da biblioteca). */
export const isNativeHd = (key: string): boolean => key.startsWith('motos/') || key.startsWith('itens/');

export async function loadAssets(): Promise<Assets> {
  const [entries, lib] = await Promise.all([
    Promise.all(Object.entries(URLS).map(async ([p, url]) => [keyOf(p), await loadImage(url)] as const)),
    loadLibrary(['caes_costas', 'itens', 'capacete', 'hud']),
  ]);
  const assets: Assets = Object.fromEntries(entries);
  for (const [k, img] of Object.entries(lib)) if (k.startsWith('lib/caes_costas/')) assets[k.replace('lib/caes_costas/', 'motos/')] = img;
  // itens do jogo = sprites da biblioteca (apelidos `itens/<tipo>`)
  for (const t of ['capacete', 'pacote', 'vida', 'velocidade', 'grau']) assets[`itens/${t}`] = lib[`lib/itens/pickup_${t}`];
  assets['itens/coracao'] = lib['lib/hud/coracao_cheio'];
  for (let i = 0; i < 4; i++) assets[`itens/capacete_voo_${i}`] = lib[`lib/capacete/p1_${i}`];
  return assets;
}

// ------------------------------------------------------------ troca de cor
// As motos são desenhadas com magenta: base #ff00ff, sombra #b000b0, brilho #ff9cff.
const KEY_BASE = [255, 0, 255];
const KEY_DARK = [176, 0, 176];
const KEY_LIGHT = [255, 156, 255];

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const cache = new Map<string, HTMLCanvasElement>();

/** Sprite de moto pintado com a cor escolhida (cacheado). */
export function recolored(assets: Assets, key: string, hex: string): HTMLCanvasElement {
  const ck = `${key}|${hex}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const img = assets[key];
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const base = hexRgb(hex);
  const dark = base.map((v) => Math.round(v * 0.7));
  const light = base.map((v) => Math.min(255, Math.round(v * 1.25) + 30));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const same = (k: number[]) => d[i] === k[0] && d[i + 1] === k[1] && d[i + 2] === k[2];
    const to = same(KEY_BASE) ? base : same(KEY_DARK) ? dark : same(KEY_LIGHT) ? light : null;
    if (to) {
      d[i] = to[0];
      d[i + 1] = to[1];
      d[i + 2] = to[2];
    }
  }
  ctx.putImageData(data, 0, 0);
  cache.set(ck, c);
  return c;
}
