import { libUrl } from '../../../shared/sprites';

const dirs = ['r', 'd', 'l', 'u'] as const;
const sprite = (n: string) => `sprites/${n}.png`;

const FILES: Record<string, string> = {
  heli_0: sprite('heli_0'),
  heli_1: sprite('heli_1'),
  heli_2: sprite('heli_2'),
  item_turbo: sprite('item_turbo'),
  item_oleo: sprite('item_oleo'),
  item_capacete: sprite('item_capacete'),
  item_pizza: sprite('item_pizza'),
  item_vida: sprite('item_vida'),
  pino_coleta: sprite('pino_coleta'),
  pino_entrega: sprite('pino_entrega'),
  // biblioteca compartilhada (HD 2× nativo)
  cachorro_grau: 'lib/caes/p1_grau_0',
  coracao_cheio: 'lib/hud/coracao_cheio',
  coracao_vazio: 'lib/hud/coracao_vazio',
  capacete_hud: 'lib/capacete/p1_0',
};
for (const name of ['moto', 'carro', 'motopm']) {
  for (const d of dirs) for (const f of [0, 1]) FILES[`${name}_${d}_${f}`] = sprite(`${name}_${d}_${f}`);
}

export type Assets = Record<string, HTMLImageElement>;

const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

/** Sprites da biblioteca compartilhada já vêm em alta definição (2× nativo): o Scale2x só copia. */
export const isNativeHd = (key: string): boolean => FILES[key]?.startsWith('lib/') ?? false;

export function assetUrl(key: string): string {
  const file = FILES[key];
  if (!file) throw new Error(`Asset desconhecido: ${key}`);
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
  const keys = Object.keys(FILES);
  const imgs = await Promise.all(keys.map((k) => loadImage(assetUrl(k))));
  return Object.fromEntries(keys.map((k, i) => [k, imgs[i]]));
}
