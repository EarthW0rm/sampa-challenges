const FILES: Record<string, string> = { fundo: 'cenario/tabuleiro.png' };
for (const side of ['w', 'b']) {
  for (const t of ['p', 'n', 'b', 'r', 'q', 'k']) {
    FILES[side + t] = `pecas/${side}${t}.png`;
    FILES[`mini_${side}${t}`] = `pecas/mini_${side}${t}.png`;
  }
}

export type Assets = Record<string, HTMLImageElement>;

/** URLs finais (com hash) de todos os PNGs da pasta assets deste jogo. */
const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

export function assetUrl(key: string): string {
  const url = URLS['../assets/' + FILES[key]];
  if (!url) throw new Error(`Asset não encontrado: ${key}`);
  return url;
}

/** Chave do sprite de uma peça: cor 0/1 e tipo 1–6 (`chess.ts`). `mini` = versão das capturadas. */
export const pieceKey = (color: number, type: number, mini = false) => `${mini ? 'mini_' : ''}${color ? 'b' : 'w'}${' pnbrqk'[type]}`;

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
