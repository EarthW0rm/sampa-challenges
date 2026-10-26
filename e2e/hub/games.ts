/**
 * Ordem esperada dos cards, calculada como o `registry.ts` calcula (`order ?? 100`, depois o título),
 * lendo os `manifest.ts` como texto (eles importam PNGs, que o Node não carrega).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GAMES_DIR = fileURLToPath(new URL('../../src/games/', import.meta.url));

export interface HubGame {
  id: string;
  title: string;
  order: number;
}

export const HUB_GAMES: HubGame[] = readdirSync(GAMES_DIR)
  .filter((d) => !d.startsWith('_'))
  .map((id) => {
    const src = readFileSync(`${GAMES_DIR}${id}/manifest.ts`, 'utf8');
    const title = /title:\s*'([^']*)'/.exec(src)?.[1] ?? id;
    const order = Number(/order:\s*(\d+)/.exec(src)?.[1] ?? 100);
    return { id, title, order };
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
