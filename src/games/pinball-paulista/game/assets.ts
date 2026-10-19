import { libUrl } from '../../../shared/sprites';

const FILES = {
  fundo: 'mesa/fundo.png',
  bumper_0: 'mesa/bumper_0.png',
  bumper_1: 'mesa/bumper_1.png',
  bumper_2: 'mesa/bumper_2.png',
  bumper_3: 'mesa/bumper_3.png',
  // biblioteca compartilhada (HD 2× nativo)
  capacete_0: 'lib/capacete/p1_0',
  capacete_1: 'lib/capacete/p1_1',
  cachorro_grau: 'lib/caes/p1_grau_0',
  cachorro_tonto: 'lib/caes/p1_tonto',
  brilho_0: 'lib/fx/brilho_0',
  brilho_1: 'lib/fx/brilho_1',
  brilho_2: 'lib/fx/brilho_2',
  explosao_0: 'lib/fx/explosao_0',
  explosao_1: 'lib/fx/explosao_1',
  explosao_2: 'lib/fx/explosao_2',
} as const;

export type AssetKey = keyof typeof FILES;
export type Assets = Record<AssetKey, HTMLImageElement>;

const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

/** Sprites da biblioteca compartilhada já vêm em alta definição (2× nativo): o Scale2x só copia. */
export const isNativeHd = (key: string): boolean => (FILES as Record<string, string>)[key]?.startsWith('lib/') ?? false;

export function assetUrl(key: AssetKey): string {
  const file: string = FILES[key];
  if (file.startsWith('lib/')) return libUrl(file);
  const url = URLS['../assets/' + file];
  if (!url) throw new Error(`Asset não encontrado: ${file}`);
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

export async function loadAssets(): Promise<Assets> {
  const keys = Object.keys(FILES) as AssetKey[];
  const imgs = await Promise.all(keys.map((k) => loadImage(assetUrl(k))));
  return Object.fromEntries(keys.map((k, i) => [k, imgs[i]])) as Assets;
}
