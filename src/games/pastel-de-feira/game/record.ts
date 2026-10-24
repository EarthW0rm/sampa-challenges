/** Recordes (RN-56). Leve: o manifest importa só este arquivo. */
const KEY_DAY = 'pastel-de-feira:recorde';
const KEY_CASH = 'pastel-de-feira:recorde-caixa';
const KEY_POINT = 'pastel-de-feira:recorde-ponto';

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browser = (): Store | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

function read(key: string, store: Store | null): number {
  try {
    const v = Number(store?.getItem(key));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

/** Grava só se superar o recorde atual. Devolve true se gravou. */
function raise(key: string, value: number, store: Store | null): boolean {
  const v = Math.floor(value);
  if (!Number.isFinite(v) || v <= read(key, store)) return false;
  try {
    store?.setItem(key, String(v));
    return true;
  } catch {
    return false;
  }
}

/** Maior dia concluído (card do hub). */
export const loadRecord = (store: Store | null = browser()): number => read(KEY_DAY, store);
export const loadCashRecord = (store: Store | null = browser()): number => read(KEY_CASH, store);
export const loadPointRecord = (store: Store | null = browser()): number => read(KEY_POINT, store);

export const saveDayRecord = (day: number, store: Store | null = browser()): boolean => raise(KEY_DAY, day, store);
export const saveCashRecord = (cash: number, store: Store | null = browser()): boolean => raise(KEY_CASH, cash, store);
export const savePointRecord = (value: number, store: Store | null = browser()): boolean => raise(KEY_POINT, value, store);

/** Recorde do card do hub: o maior dia concluído e, depois de zerar, o maior caixa do modo livre (RN-56). */
export const loadHubRecord = (store: Store | null = browser()): number => loadCashRecord(store) || loadRecord(store);
