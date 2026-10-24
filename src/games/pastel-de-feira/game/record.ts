/** Maior dia concluído (card do hub). Leve: o manifest importa só este arquivo. */
const KEY = 'pastel-de-feira:recorde';

export function loadRecord(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}
