import type { Level } from './ai';
import type { Settings } from './types';

const KEY = 'sinuca-de-bar:config';

export const DEFAULT_SETTINGS: Settings = {
  mode: 'pvc',
  rules: 'lisas',
  level: 2,
  names: ['Jogador 1', 'Jogador 2'],
  breaker: 'p1',
};

/** Últimas escolhas do menu (modo, regra, nível, nomes, saída). */
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...raw };
    const level = Number(s.level);
    return {
      mode: s.mode === 'pvp' ? 'pvp' : 'pvc',
      rules: s.rules === 'parimpar' ? 'parimpar' : 'lisas',
      level: (level === 1 || level === 3 ? level : 2) as Level,
      names: [String(s.names?.[0] ?? DEFAULT_SETTINGS.names[0]), String(s.names?.[1] ?? DEFAULT_SETTINGS.names[1])],
      breaker: s.breaker === 'p2' || s.breaker === 'random' ? s.breaker : 'p1',
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
