import { CONSUMABLE_IDS, INGREDIENTS } from '../data/catalog';
import { EQUIP_IDS } from '../data/equipment';
import { COURSE_IDS, POSITION_LABEL, TRAIT_IDS } from '../data/staff';
import { ITEMS } from '../data/recipes';
import { HISTORY_MAX } from './closing';
import { clampPrice } from './pricing';
import { PASTRY_PROFILES, type Campaign, type DayHistory, type InvLot, type Theme } from './types';

/** Persistência da campanha (plan.md 3.3): schema versionado, type guards à mão e migrações. Sem `localStorage` direto. */

export const SAVE_KEY = 'pastel-de-feira:campanha';
export const CURRENT_VERSION = 1;
const MAX_SAVE_CHARS = 400_000;

/** O que o save precisa do navegador; o node usa um fake em memória. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SavePhase = 'preparo' | 'dia' | 'fim';

/**
 * `campaign` é o estado de campanha da fase: no Preparo, o atual; em `dia`, o checkpoint do início
 * do Dia de Feira (a retomada recomeça dali); em `fim`, o estado depois da falência.
 */
export interface SaveV1 {
  version: 1;
  phase: SavePhase;
  campaign: Campaign;
}

export type LoadWarning = 'invalido' | 'semPersistencia';

export interface LoadResult {
  save: SaveV1 | null;
  aviso?: LoadWarning;
}

export type Migration = (save: unknown) => unknown;
/** `migrations[n]` converte a versão n para a n+1. */
export const MIGRATIONS: Record<number, Migration> = {};

// ---------------------------------------------------------------- guards

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min = 0, max = 1e9): v is number => isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStr = (v: unknown): v is string => typeof v === 'string';
const THEMES: readonly Theme[] = ['popular', 'tradicional', 'gourmet'];

function isLot(v: unknown): v is InvLot {
  return (
    isRec(v) && isStr(v.ingredient) && INGREDIENTS[v.ingredient] !== undefined && isInt(v.qty, 0, 100000) &&
    isNum(v.unitCost) && v.unitCost >= 0 && v.unitCost < 1000 && isInt(v.expires, 1, 1e6) && isBool(v.inCooler)
  );
}

function isHistory(v: unknown): v is DayHistory {
  return (
    isRec(v) && isInt(v.day, 1) && isInt(v.calendar, 1) && isNum(v.revenue) && isNum(v.profit) && isNum(v.reputation) &&
    isBool(v.met) && isInt(v.served) && isInt(v.lost) && isInt(v.wasteUnits)
  );
}

function isStaff(v: unknown): boolean {
  if (!isRec(v) || !isInt(v.id, 1) || !isStr(v.name) || v.name.length > 40) return false;
  if (v.kind !== 'fritador' && v.kind !== 'geral') return false;
  const uniqueOf = (list: unknown, ids: readonly string[]) => Array.isArray(list) && list.every((x) => isStr(x) && ids.includes(x)) && new Set(list).size === list.length;
  if (!uniqueOf(v.traits, TRAIT_IDS) || !uniqueOf(v.courses, COURSE_IDS) || (v.traits as unknown[]).length > 2) return false;
  if (v.mode !== 'fixo' && v.mode !== 'auto') return false;
  if (v.mode === 'auto' ? v.position !== null : !(isStr(v.position) && v.position in POSITION_LABEL)) return false;
  return isBool(v.trainedToday);
}

const knownItems = (list: unknown): list is string[] => Array.isArray(list) && list.every((i) => isStr(i) && ITEMS[i] !== undefined);

/** Valida a campanha inteira: tipos, faixas, enums e referências ao catálogo. Sem conserto parcial. */
export function isCampaign(v: unknown): v is Campaign {
  if (!isRec(v)) return false;
  if (!isInt(v.seed, 0, 4294967295) || !isInt(v.day, 1, 100000) || !isInt(v.calendar, 1, 1e6)) return false;
  if (!isBool(v.freeMode) || !isNum(v.cash) || Math.abs(v.cash) > 1e9) return false;
  if (!isNum(v.reputation) || v.reputation < 1 || v.reputation > 5) return false;
  if (!isStr(v.profile) || !PASTRY_PROFILES.includes(v.profile as never)) return false;
  if (v.theme !== null && !(isStr(v.theme) && THEMES.includes(v.theme as Theme))) return false;
  if (!isBool(v.eventsOn) || !isBool(v.tutorial) || !isInt(v.boughtToday) || !isInt(v.resumes)) return false;
  if (!Array.isArray(v.inventory) || v.inventory.length > 500 || !v.inventory.every(isLot)) return false;
  if (!isRec(v.consumables) || !CONSUMABLE_IDS.every((id) => isInt((v.consumables as Rec)[id], 0, 999))) return false;

  const o = v.owned;
  if (!isRec(o) || !knownItems(o.items) || new Set(o.items).size !== o.items.length) return false;
  if (!isInt(o.slotsSalgado, 3, 7) || !isInt(o.slotsDoce, 2, 3) || !isInt(o.coolers, 0, 2) || !isNum(o.spent) || o.spent < 0) return false;
  if (!isInt(o.extraM2, 0, 18) || !Array.isArray(o.equip) || new Set(o.equip).size !== o.equip.length) return false;
  if (!o.equip.every((e) => isStr(e) && (EQUIP_IDS as readonly string[]).includes(e))) return false;
  if (!Array.isArray(o.tachos) || o.tachos.length < 1 || o.tachos.length > 3) return false;
  for (const t of o.tachos) {
    if (!isRec(t) || (t.baskets !== 2 && t.baskets !== 4) || (t.oil !== 'comum' && t.oil !== 'algodao')) return false;
    if (!isBool(t.thermostat) || !isBool(t.alarm) || !isBool(t.timer)) return false;
  }
  if (!isInt(o.tables, 0, 4) || !isBool(o.delivery) || !isBool(o.office) || !isInt(o.rest, 0, 4) || o.rest === 1) return false;
  const used = (o.tachos.length - 1) * 2 + o.coolers + o.tables * 2 + (o.delivery ? 3 : 0) + (o.office ? 4 : 0) + (o.rest > 0 ? 1 : 0);
  if (used > o.extraM2) return false; // espaço usado nunca passa do comprado

  const m = v.menu;
  if (!isRec(m) || !knownItems(m.salgados) || !knownItems(m.doces) || !knownItems(m.bebidas)) return false;
  const owned = new Set(o.items);
  const menuOk = (list: string[], kind: string, max: number) =>
    list.length <= max && new Set(list).size === list.length && list.every((i) => owned.has(i) && ITEMS[i].kind === kind);
  if (!menuOk(m.salgados, 'salgado', o.slotsSalgado) || !menuOk(m.doces, 'doce', o.slotsDoce) || !menuOk(m.bebidas, 'bebida', 99)) return false;

  if (!isRec(v.prices)) return false;
  for (const [k, p] of Object.entries(v.prices)) {
    if (!owned.has(k) || !isNum(p) || clampPrice(k, p) !== p) return false;
  }
  const pr = v.promo;
  if (!isRec(pr) || !(pr.brindeN === 0 || isInt(pr.brindeN, 2, 6)) || !isInt(pr.chorinho, 0, 3) || !isBool(pr.xepa)) return false;
  if (!isNum(pr.xepaDiscount) || ![0.1, 0.2, 0.3, 0.4, 0.5].some((d) => Math.abs(d - (pr.xepaDiscount as number)) < 1e-9)) return false;
  if (!isBool(v.deliveryOn) || !isBool(v.autoAccept)) return false;
  if (!isInt(v.nextStaffId, 1) || !Array.isArray(v.hiredToday) || !v.hiredToday.every(isStr)) return false;
  if (!Array.isArray(v.staff) || v.staff.length > 11 || !v.staff.every(isStaff)) return false;
  if (new Set(v.staff.map((s) => (s as Rec).id)).size !== v.staff.length) return false;
  if (!isRec(v.fatigue) || !Object.entries(v.fatigue).every(([k, n]) => isStr(k) && isInt(n, 0, 10000))) return false;
  if (!Array.isArray(v.history) || v.history.length > HISTORY_MAX || !v.history.every(isHistory)) return false;
  return true;
}

export function isSave(v: unknown): v is SaveV1 {
  return isRec(v) && v.version === CURRENT_VERSION && (v.phase === 'preparo' || v.phase === 'dia' || v.phase === 'fim') && isCampaign(v.campaign);
}

// ---------------------------------------------------------------- migração

/** Aplica as migrações em sequência até a versão alvo. Devolve undefined se faltar alguma. */
export function migrate(raw: unknown, target: number, table: Record<number, Migration>): unknown {
  let cur = raw;
  let guard = 0;
  while (isRec(cur) && isInt(cur.version, 0) && cur.version < target && guard++ < 100) {
    const step = table[cur.version];
    if (!step) return undefined;
    cur = step(cur);
  }
  return isRec(cur) && cur.version === target ? cur : undefined;
}

// ---------------------------------------------------------------- load/save

function warn(reason: string): void {
  console.warn(`[pastel-de-feira] save inválido: ${reason}`);
}

/** Lê o save. Inválido: descarta com aviso. Armazenamento indisponível: `semPersistencia`. */
export function load(storage: StorageLike | null, table: Record<number, Migration> = MIGRATIONS): LoadResult {
  if (!storage) return { save: null, aviso: 'semPersistencia' };
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { save: null, aviso: 'semPersistencia' };
  }
  if (text === null) return { save: null };
  if (text.length > MAX_SAVE_CHARS) {
    warn('arquivo grande demais');
    return { save: null, aviso: 'invalido' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    warn('JSON quebrado');
    return { save: null, aviso: 'invalido' };
  }
  const migrated = migrate(raw, CURRENT_VERSION, table);
  if (!migrated) {
    warn('versão desconhecida ou sem migração');
    return { save: null, aviso: 'invalido' };
  }
  if (!isSave(migrated)) {
    warn('estrutura fora do schema');
    return { save: null, aviso: 'invalido' };
  }
  return { save: migrated };
}

/** Grava o save. Cota cheia: reduz o histórico pela metade e tenta mais uma vez. Devolve false se não gravou. */
export function saveCampaign(storage: StorageLike | null, campaign: Campaign, phase: SavePhase): boolean {
  if (!storage) return false;
  const write = (c: Campaign): boolean => {
    try {
      storage.setItem(SAVE_KEY, JSON.stringify({ version: CURRENT_VERSION, phase, campaign: c } satisfies SaveV1));
      return true;
    } catch {
      return false;
    }
  };
  if (write(campaign)) return true;
  const lighter = { ...campaign, history: campaign.history.slice(Math.floor(campaign.history.length / 2)) };
  return write(lighter);
}

/** Checkpoint do início do Dia de Feira: a retomada recomeça deste estado (JA-06). */
export const saveCheckpoint = (storage: StorageLike | null, campaign: Campaign): boolean => saveCampaign(storage, campaign, 'dia');

export function clearSave(storage: StorageLike | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* sem armazenamento: nada a limpar */
  }
}

/** `localStorage` do navegador, ou null quando bloqueado (modo privado). */
export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = 'pastel-de-feira:teste';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
