const FILES: Record<string, string> = { fundo: 'cenario/mesa.png', sombra: 'bolas/sombra.png', mira: 'bolas/mira.png' };
for (let n = 0; n < 16; n++) FILES[`b${n}`] = `bolas/b${n}.png`;

export type Assets = Record<string, HTMLImageElement>;

/** URLs finais (com hash) de todos os PNGs da pasta assets deste jogo. */
const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

/** As bolas, a sombra e a mira já vêm em 2× nativo (o número só é legível assim): o Scale2x só copia. */
export const isNativeHd = (key: string): boolean => FILES[key]?.startsWith('bolas/') ?? false;

export function assetUrl(key: string): string {
  const url = URLS['../assets/' + FILES[key]];
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

export async function loadAssets(): Promise<Assets> {
  const keys = Object.keys(FILES);
  const imgs = await Promise.all(keys.map((k) => loadImage(assetUrl(k))));
  return Object.fromEntries(keys.map((k, i) => [k, imgs[i]]));
}
