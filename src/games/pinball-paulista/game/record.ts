const KEY = 'pinball-paulista:recorde';

export function loadRecord(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveRecord(score: number) {
  try {
    localStorage.setItem(KEY, String(score));
  } catch {
    /* navegação privada ou armazenamento bloqueado: sem recorde */
  }
}
