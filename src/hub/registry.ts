import type { GameManifest } from './types';

/**
 * Descobre os jogos: todo `src/games/<pasta>/manifest.ts` entra no hub.
 * Pastas que começam com "_" (como `_modelo`) ficam de fora.
 */
const modules = import.meta.glob<{ default: GameManifest }>(
  ['../games/*/manifest.ts', '!../games/_*/manifest.ts'],
  { eager: true },
);

export const games: GameManifest[] = Object.entries(modules)
  .map(([path, mod]) => {
    const folder = path.split('/')[2];
    const manifest = mod.default;
    if (manifest.id !== folder) {
      console.warn(`[hub] o id "${manifest.id}" não bate com a pasta "${folder}"; usando o nome da pasta.`);
      return { ...manifest, id: folder };
    }
    return manifest;
  })
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));

export function findGame(id: string): GameManifest | undefined {
  return games.find((g) => g.id === id);
}
