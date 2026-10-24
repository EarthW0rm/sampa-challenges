/**
 * Sprites do jogo: cachorros de pé da biblioteca (`caes_pe`, 2× nativo) recoloridos em tempo de
 * execução. O pelo vem em cores-chave magenta (RN-165); a aparência é uma função pura de
 * (semente, id) e nunca usa o `rng` das regras, então não muda o equilíbrio.
 */

export const RACAS = ['caramelo', 'pitbull', 'pincher', 'collie', 'dalmata', 'salsicha', 'vira-lata'] as const;
export type Raca = (typeof RACAS)[number];
export type Porte = 'p' | 'm' | 'g';
export const PORTES: readonly Porte[] = ['p', 'm', 'g'];
export type Pose = 'parado' | 'andando_0' | 'andando_1' | 'sentado' | 'comendo_0' | 'comendo_1' | 'bravo' | 'feliz';
export type Equipe = 'pasteleiro' | 'func_fritador' | 'func_geral';

/** Cores de pelagem sorteadas (base; sombra e brilho saem dela). */
export const PELAGENS = ['#d9903f', '#8a5a33', '#e8e2d0', '#8b8fa3', '#3e3240', '#c9a46a', '#f2c27a', '#a8704a'] as const;

/** Pixels do PNG por pixel lógico (biblioteca em 2× nativo). */
export const LIB_PX = 2;

export interface Aparencia {
  raca: Raca;
  porte: Porte;
  cor: string;
}

/** Hash 32 bits estável (mulberry32 de uma mistura), só para a aparência. */
function hash(seed: number, id: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(id + 1, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

export function aparenciaDe(seed: number, id: number, salt = 0): Aparencia {
  const h = hash(seed, id, salt);
  return {
    raca: RACAS[h % RACAS.length],
    porte: PORTES[Math.floor(h / 7) % 3],
    cor: PELAGENS[Math.floor(h / 23) % PELAGENS.length],
  };
}

const KEY_BASE = [255, 0, 255];
const KEY_DARK = [176, 0, 176];
const KEY_LIGHT = [255, 156, 255];

function hexRgb(hex: string): number[] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export class Assets {
  private cache = new Map<string, HTMLCanvasElement>();

  constructor(private readonly lib: Record<string, HTMLImageElement>) {}

  /** Imagem recolorida (cacheada por chave e cor). `null` se o PNG não existe. */
  private recolored(key: string, hex: string): HTMLCanvasElement | null {
    const ck = `${key}|${hex}`;
    const hit = this.cache.get(ck);
    if (hit) return hit;
    const img = this.lib[key];
    if (!img) return null;
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
    this.cache.set(ck, c);
    return c;
  }

  /** Cliente pronto para `blit`: raça, porte, cor e pose. */
  cliente(raca: Raca, porte: Porte, cor: string, pose: Pose): HTMLCanvasElement | null {
    return this.recolored(`lib/caes_pe/${raca}_${porte}_${pose}`, cor);
  }

  /** Pasteleiro e funcionários (avental e chapéu fixos; pelo na cor dada). */
  equipe(kind: Equipe, cor: string, pose: Pose): HTMLCanvasElement | null {
    return this.recolored(`lib/caes_pe/${kind}_${pose}`, cor);
  }

  get cacheSize(): number {
    return this.cache.size;
  }
}

let current: Assets | null = null;
let pending: Promise<Assets> | null = null;

/** Carrega tudo uma vez; se falhar, a próxima chamada tenta de novo ("Tentar de novo"). */
export function loadAll(): Promise<Assets> {
  if (current) return Promise.resolve(current);
  // import dinâmico: a simulação sem tela (esbuild + node) não carrega `import.meta.glob`
  pending ??= import('../../../shared/sprites')
    .then((m) => m.loadLibrary(['caes_pe']))
    .then((lib) => (current = new Assets(lib)))
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Assets já carregados (a tela só abre depois do `loadAll`); `null` cai nos placeholders. */
export const getAssets = (): Assets | null => current;
