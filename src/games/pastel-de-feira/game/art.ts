/** PNGs do jogo (1×, em `assets/`): carregados e ampliados com Scale2x. Módulo carregado só no navegador. */
import { scale2x } from './hires';

const URLS = import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' });

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
    img.src = src;
  });
}

/** Nome (`cenario/fundo`, `itens/copo`…) → imagem em alta (2×). A capa (manifest) e os ícones `ui/hud_*` (DOM) ficam fora. */
export async function loadArt(): Promise<Record<string, HTMLCanvasElement>> {
  const wanted = Object.keys(URLS).filter((p) => !p.endsWith('/capa.png') && !p.includes('/ui/hud_'));
  const entries = await Promise.all(
    wanted.map(async (p) => [p.replace('../assets/', '').replace(/\.png$/, ''), scale2x(await loadImage(URLS[p]))] as const),
  );
  return Object.fromEntries(entries);
}
