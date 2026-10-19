const FILES = {
  cachorro_0: 'lib/caes/p1_normal_0',
  cachorro_1: 'lib/caes/p1_normal_1',
  cachorro_turbo_0: 'lib/caes/p1_turbo_0',
  cachorro_turbo_1: 'lib/caes/p1_turbo_1',
  cachorro_grau_0: 'lib/caes/p1_grau_0',
  cachorro_grau_1: 'lib/caes/p1_grau_1',
  cachorro_tonto: 'lib/caes/p1_tonto',
  caixa: 'lib/itens/caixa_caixa',
  pizza: 'lib/itens/pizza',
  sacola: 'lib/itens/sacola',
  turbo: 'lib/itens/caixa_turbo',
  grau: 'lib/itens/caixa_grau',
  ima: 'lib/itens/caixa_ima',
  vida: 'lib/itens/caixa_vida',
  dobro: 'lib/itens/caixa_dobro',
  bomba_0: 'lib/itens/bomba_0',
  bomba_1: 'lib/itens/bomba_1',
  brilho_0: 'lib/fx/brilho_0',
  brilho_1: 'lib/fx/brilho_1',
  brilho_2: 'lib/fx/brilho_2',
  poeira_0: 'lib/fx/poeira_0',
  poeira_1: 'lib/fx/poeira_1',
  poeira_2: 'lib/fx/poeira_2',
  explosao_0: 'lib/fx/explosao_0',
  explosao_1: 'lib/fx/explosao_1',
  explosao_2: 'lib/fx/explosao_2',
  caixa_amassada: 'lib/fx/caixa_amassada',
  esteira_0: 'esteira/esteira_0.png',
  esteira_1: 'esteira/esteira_1.png',
  esteira_2: 'esteira/esteira_2.png',
  esteira_3: 'esteira/esteira_3.png',
  esteira_ponta_dir_0: 'esteira/esteira_ponta_dir_0.png',
  esteira_ponta_dir_1: 'esteira/esteira_ponta_dir_1.png',
  esteira_ponta_dir_2: 'esteira/esteira_ponta_dir_2.png',
  esteira_ponta_dir_3: 'esteira/esteira_ponta_dir_3.png',
  esteira_ponta_esq_0: 'esteira/esteira_ponta_esq_0.png',
  esteira_ponta_esq_1: 'esteira/esteira_ponta_esq_1.png',
  esteira_ponta_esq_2: 'esteira/esteira_ponta_esq_2.png',
  esteira_ponta_esq_3: 'esteira/esteira_ponta_esq_3.png',
  esteira_pe: 'esteira/esteira_pe.png',
  desvio_desce: 'esteira/desvio_desce.png',
  desvio_rua: 'esteira/desvio_rua.png',
  restaurante: 'cenario/restaurante.png',
  chapeiro_0: 'cenario/chapeiro_0.png',
  chapeiro_1: 'cenario/chapeiro_1.png',
  fundo_rua: 'cenario/fundo_rua.png',
  coracao_cheio: 'lib/hud/coracao_cheio',
  coracao_vazio: 'lib/hud/coracao_vazio',
} as const;

export type AssetKey = keyof typeof FILES;
export type Assets = Record<AssetKey, HTMLImageElement>;

import { libUrl } from '../../../shared/sprites';

/** URLs finais (com hash) de todos os PNGs da pasta assets deste jogo. */
const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

/** Sprites da biblioteca compartilhada (`src/shared/sprites`) já vêm em alta definição (2× nativo). */
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
