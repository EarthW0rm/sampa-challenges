import type { DayConfig } from '../game/types';

/** DayConfig fixo de desenvolvimento e de teste: Carne, Queijo e Caldo puro, estoque cheio, 1 tacho pequeno e a moenda manual. */
export function devConfig(overrides: Partial<DayConfig> = {}): DayConfig {
  return {
    day: 1,
    reputation: 3,
    menu: [
      { item: 'carne', price: 7 },
      { item: 'queijo', price: 7 },
      { item: 'caldo-puro', price: 6 },
    ],
    stock: [
      { ingredient: 'massa', qty: 80, daysLeft: 3 },
      { ingredient: 'carne', qty: 40, daysLeft: 1 },
      { ingredient: 'mucarela', qty: 40, daysLeft: 1 },
      { ingredient: 'oregano', qty: 40, daysLeft: 1 },
      { ingredient: 'cana', qty: 30, daysLeft: 1 },
    ],
    consumables: { copo: 40, saquinho: 100, embalagem: 0 },
    stations: ['balcao', 'bancada', 'tacho1', 'moenda'],
    tachos: [{ baskets: 2, oil: 'comum', thermostat: false, alarm: false, timer: false }],
    equipment: { drainer: false, warmer: 0, mill: 'manual', thermalBag: false, autoMill: false, cardMachine: false },
    staff: [],
    positions: ['balcao', 'colocador1', 'fritador1', 'trocador', 'moenda'],
    profile: 'tradicional',
    season: 'outono',
    forecast: null,
    eventsOn: false,
    annulFine: false,
    claimRefused: false,
    orders: [],
    roles: [],
    promo: { brindeN: 0, chorinho: 0, xepa: false, xepaDiscount: 0.3 },
    theme: null,
    delivery: { on: false, auto: false, partner: false },
    tables: 0,
    restSlots: 0,
    coolers: 0,
    ...overrides,
  };
}
