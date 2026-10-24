import { STOCK_CAPACITY } from '../constants';
import { INGREDIENTS, DOUGH_SHELF_DAYS, CONSUMABLE_IDS } from '../data/catalog';
import { ITEMS, type ItemId } from '../data/recipes';
import type { DayConfig, MenuEntry, StationId } from '../types';
import type { Campaign, NewCampaignOptions } from './types';
import { fatigueFactor } from './fatigue';
import { defaultPrice } from './pricing';

export const START_CASH = 200;
export const START_REPUTATION = 3;
export const TRADITIONAL_CASH_BONUS = 100;
/** Capacidade extra por caixa térmica (RN-39). */
export const COOLER_CAPACITY = 80;
export const CAMPAIGN_DAYS = 20;

export const round2 = (v: number): number => Math.round(v * 100) / 100;

export function newCampaign(opts: NewCampaignOptions): Campaign {
  const items: ItemId[] = ['carne', 'queijo', 'caldo-puro'];
  const prices: Record<ItemId, number> = {};
  for (const id of items) prices[id] = defaultPrice(id);
  return {
    seed: opts.seed,
    day: 1,
    calendar: 1,
    freeMode: false,
    cash: START_CASH + (opts.profile === 'tradicional' ? TRADITIONAL_CASH_BONUS : 0),
    reputation: START_REPUTATION,
    profile: opts.profile,
    theme: null,
    eventsOn: opts.eventsOn,
    tutorial: opts.tutorial,
    inventory: [],
    consumables: { copo: 0, saquinho: 0, embalagem: 0 },
    owned: {
      items,
      slotsSalgado: 3,
      slotsDoce: 2,
      tachos: [{ baskets: 2, oil: 'comum' }],
      coolers: 0,
      spent: 0,
    },
    menu: { salgados: ['carne', 'queijo'], doces: [], bebidas: ['caldo-puro'] },
    prices,
    fatigue: {},
    boughtToday: 0,
    resumes: 0,
    history: [],
  };
}

export const cloneCampaign = (c: Campaign): Campaign => structuredClone(c);

/** Capacidade de estoque de alimento em unidades (RN-38, RN-39). */
export const capacityMax = (c: Campaign): number => STOCK_CAPACITY + COOLER_CAPACITY * c.owned.coolers;

export const capacityUsed = (c: Campaign): number => c.inventory.reduce((n, l) => n + l.qty, 0);

export const capacityFree = (c: Campaign): number => Math.max(0, capacityMax(c) - capacityUsed(c));

/** Estoque atual de um insumo. */
export const stockOf = (c: Campaign, ing: string): number =>
  c.inventory.reduce((n, l) => (l.ingredient === ing ? n + l.qty : n), 0);

/** Último dia de validade de um insumo comprado hoje: massa vale 3 dias, o resto só hoje (RN-34). */
export const expiryFor = (c: Campaign, ing: string): number =>
  INGREDIENTS[ing].kind === 'massa' ? c.calendar + DOUGH_SHELF_DAYS - 1 : c.calendar;

/** Meta de lucro líquido do dia N (RN-50). */
export const profitGoal = (day: number): number => Math.round(80 * Math.pow(1.18, day - 1) * 100) / 100;

/** Reputação mínima ao fim do dia N (RN-50). */
export const minReputation = (day: number): number => (day <= 5 ? 2 : day <= 12 ? 3 : 3.5);

/** Hash determinístico da semente do dia: muda com o calendário e com cada retomada (PA-13). */
export function daySeed(c: Campaign): number {
  let h = (c.seed ^ Math.imul(c.calendar, 0x9e3779b1)) >>> 0;
  h = (h ^ Math.imul(c.resumes + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0 || 1;
}

/** Cardápio do dia com preço e procura (fadiga). */
export function menuEntries(c: Campaign): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const id of [...c.menu.salgados, ...c.menu.doces, ...c.menu.bebidas]) {
    out.push({ item: id, price: c.prices[id] ?? defaultPrice(id), weight: ITEMS[id].kind === 'bebida' ? 1 : fatigueFactor(c, ITEMS[id].base) });
  }
  return out;
}

/** Estações que existem na barraca, na ordem física (RN-41). */
export function stationsOf(c: Campaign): StationId[] {
  const list: StationId[] = ['balcao', 'bancada'];
  c.owned.tachos.forEach((_t, i) => list.push(`tacho${i + 1}` as StationId));
  list.push('moenda');
  return list;
}

/** Campanha → simulação (`DayConfig`). Não muda a campanha. */
export function toDayConfig(c: Campaign): DayConfig {
  const consumables = { ...c.consumables };
  for (const id of CONSUMABLE_IDS) consumables[id] = Math.max(0, consumables[id]);
  return {
    day: c.day,
    reputation: c.reputation,
    menu: menuEntries(c),
    stock: c.inventory
      .filter((l) => l.qty > 0)
      .map((l) => ({ ingredient: l.ingredient, qty: l.qty, daysLeft: Math.max(1, l.expires - c.calendar + 1) })),
    consumables,
    stations: stationsOf(c),
    tachos: c.owned.tachos.map((t) => ({ ...t })),
  };
}

/** Pode abrir a feira? Precisa de ao menos um salgado no cardápio. */
export const canOpen = (c: Campaign): boolean => c.menu.salgados.length > 0;
