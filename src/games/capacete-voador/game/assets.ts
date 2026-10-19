import { libUrl } from '../../../shared/sprites';
import type { PlayerIndex } from './types';

const STATIC_FILES: Record<string, string> = {
  explosao_0: 'lib/fx/explosao_0',
  explosao_1: 'lib/fx/explosao_1',
  explosao_2: 'lib/fx/explosao_2',
  sol_normal: 'sprites/sol_normal.png',
  sol_assustado: 'sprites/sol_assustado.png',
  vento_dir: 'sprites/vento_dir.png',
  vento_esq: 'sprites/vento_esq.png',
  ceu: 'cenario/ceu_fundo.png',
  garoa: 'cenario/garoa.png',
  masp: 'predios/masp/masp.png',
};
for (const b of ['copan', 'italia', 'banespa', 'martinelli', 'predinho', 'farialima']) {
  for (const part of ['topo', 'andares', 'base']) STATIC_FILES[`${b}_${part}`] = `predios/${b}/${part}.png`;
}

/** Variações do motoboy: dano 0–2 (+ pose) e moto destruída. */
export type RiderPose = '' | '_arremesso' | '_ko' | '_grau';
const RIDER_FILES: Record<string, string> = {};
for (const p of ['p1', 'p2']) {
  for (let d = 0; d <= 2; d++) {
    for (const pose of ['', '_arremesso', '_ko', '_grau']) RIDER_FILES[`${p}_dano${d}${pose}`] = `lib/caes/${p}_dano${d}${pose}`;
  }
  RIDER_FILES[`${p}_destruida`] = `lib/caes/${p}_destruida`;
  RIDER_FILES[`${p}_destruida_ko`] = `lib/caes/${p}_destruida_ko`;
  for (let i = 0; i < 4; i++) RIDER_FILES[`capacete_${p}_${i}`] = `lib/capacete/${p}_${i}`;
}

const SPRITE_FILES: Record<string, string> = { ...STATIC_FILES, ...RIDER_FILES };

export type Assets = Record<string, HTMLImageElement>;

/** URLs finais (com hash) de todos os PNGs da pasta assets deste jogo. */
const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

/** Sprites da biblioteca compartilhada (`src/shared/sprites`) já vêm em alta definição (2× nativo). */
export const isNativeHd = (key: string): boolean => SPRITE_FILES[key]?.startsWith('lib/') ?? false;

export function assetUrl(key: string): string {
  const file = SPRITE_FILES[key];
  if (file?.startsWith('lib/')) return libUrl(file);
  const url = URLS['../assets/' + file];
  if (!url) throw new Error(`Asset não encontrado: ${key}`);
  return url;
}

export const riderKey = (player: PlayerIndex, damage: number, pose: RiderPose = '') => {
  const p = player === 0 ? 'p1' : 'p2';
  if (damage >= 3) return `${p}_destruida${pose === '_ko' ? '_ko' : ''}`;
  return `${p}_dano${damage}${pose}`;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const keys = Object.keys(SPRITE_FILES);
  const imgs = await Promise.all(keys.map((k) => loadImage(assetUrl(k))));
  return Object.fromEntries(keys.map((k, i) => [k, imgs[i]]));
}
