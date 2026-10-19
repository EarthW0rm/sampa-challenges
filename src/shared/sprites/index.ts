/**
 * Biblioteca única de sprites do Sampa Challenges.
 *
 * Todos os PNGs de `assets/` estão em alta definição nativa: 1 pixel lógico do jogo = `LIB_SCALE`
 * (2) pixels do PNG. Os jogos NÃO passam esses sprites pelo Scale2x; desenham no tamanho
 * `largura / LIB_SCALE` em coordenadas lógicas (com `setTransform(SCALE…)` ou `K` do jogo).
 *
 * Chaves: `lib/<pasta>/<nome>` (ex.: `lib/caes/caramelo_normal_0`). Veja o README desta pasta.
 */

const URLS = import.meta.glob<string>('./assets/**/*.png', { eager: true, query: '?url', import: 'default' });

/** Pixels do PNG por pixel lógico. */
export const LIB_SCALE = 2;
export const LIB_PREFIX = 'lib/';

const keyOf = (path: string) => LIB_PREFIX + path.replace('./assets/', '').replace(/\.png$/, '');

export const isLibKey = (key: string): boolean => key.startsWith(LIB_PREFIX);

/** Todas as chaves disponíveis (útil para depuração e testes). */
export const libKeys = (): string[] => Object.keys(URLS).map(keyOf);

export function libUrl(key: string): string {
  const url = URLS['./assets/' + key.slice(LIB_PREFIX.length) + '.png'];
  if (!url) throw new Error(`Sprite da biblioteca não encontrado: ${key}`);
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

/**
 * Carrega os sprites da biblioteca. `folders` limita às pastas pedidas (ex.: `['caes', 'itens']`);
 * sem argumento, carrega tudo. O resultado vem pronto para fazer `{ ...assetsDoJogo, ...lib }`.
 */
export async function loadLibrary(folders?: string[]): Promise<Record<string, HTMLImageElement>> {
  const wanted = Object.keys(URLS).filter((p) => !folders || folders.some((f) => p.startsWith(`./assets/${f}/`)));
  const entries = await Promise.all(wanted.map(async (p) => [keyOf(p), await loadImage(URLS[p])] as const));
  return Object.fromEntries(entries);
}
