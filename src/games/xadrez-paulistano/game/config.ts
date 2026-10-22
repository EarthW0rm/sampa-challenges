import { DEFAULT_LEVEL } from './constants';
import { clampLevel } from './levels';
import type { Settings } from './types';

const KEY = 'xadrez-paulistano:config';

export const DEFAULT_SETTINGS: Settings = {
  mode: 'pvc',
  level: DEFAULT_LEVEL,
  color: 'white',
  names: ['Jogador 1', 'Jogador 2'],
  autoFlip: false,
};

/** Últimas escolhas do menu (modo, nível, cor, nomes). */
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...raw };
    return {
      mode: s.mode === 'pvp' ? 'pvp' : 'pvc',
      level: clampLevel(Number(s.level) || DEFAULT_LEVEL),
      color: s.color === 'black' || s.color === 'random' ? s.color : 'white',
      names: [String(s.names?.[0] ?? DEFAULT_SETTINGS.names[0]), String(s.names?.[1] ?? DEFAULT_SETTINGS.names[1])],
      autoFlip: !!s.autoFlip,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* navegação privada ou armazenamento bloqueado: só não lembra */
  }
}
