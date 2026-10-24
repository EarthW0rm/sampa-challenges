/** Estações do ano e eventos (RN-140, RN-141, RN-150–152). Valores (P). */

export type Season = 'verao' | 'outono' | 'inverno' | 'primavera';

export const SEASONS: readonly Season[] = ['verao', 'outono', 'inverno', 'primavera'];
export const SEASON_NAME: Readonly<Record<Season, string>> = { verao: 'Verão', outono: 'Outono', inverno: 'Inverno', primavera: 'Primavera' };
export const SEASON_DAYS = 5;

// RN-141
export const SEASON_EFFECTS: Readonly<Record<Season, { drink: number; fatigue: number; twoPastries: number; rain: number }>> = {
  verao: { drink: 1.4, fatigue: 1.25, twoPastries: 1, rain: 0.25 },
  outono: { drink: 1, fatigue: 1, twoPastries: 1, rain: 0.15 },
  inverno: { drink: 0.6, fatigue: 1, twoPastries: 1.2, rain: 0.1 },
  primavera: { drink: 1, fatigue: 1, twoPastries: 1, rain: 0.15 },
};

export type Forecast = 'chuva' | 'calor' | 'subprefeitura';
export type SurpriseEvent = 'fiscal' | 'energia' | 'excursao' | 'fogo' | 'queimado';

export const FORECAST_NAME: Readonly<Record<Forecast, string>> = { chuva: 'Chuva', calor: 'Calor forte', subprefeitura: 'Subprefeitura' };
export const SURPRISE_NAME: Readonly<Record<SurpriseEvent, string>> = {
  fiscal: 'Fiscal da Vigilância', energia: 'Queda de energia', excursao: 'Excursão', fogo: 'Fogo no tacho', queimado: 'Funcionário queimado',
};

// RN-150
export const EVENTS_FIRST_DAY = 4;

// RN-151
export const FORECAST = {
  calorChance: 0.2,
  subprefeituraChance: 0.08,
  rainArrival: 0.6,
  rainApp: 1.5,
  rainTables: 0.5,
  heatDrink: 1.5,
  heatFatigue: 1.25,
  claimChance: 0.3,
  claimPavio: 2,
  claimManager: 0.5,
  claimRaise: 1.1,
  claimRaiseDays: 3,
  claimRefusedSpeed: 0.85,
} as const;

// RN-152
export const SURPRISE = {
  fiscalChance: 0.12,
  fiscalFirstHour: 9,
  fiscalLastHour: 13,
  fine: 150,
  repPenalty: 0.3,
  energyChance: 0.08,
  energyMin: 20,
  energyMax: 40,
  excursionChance: 0.08,
  excursionClients: 15,
  excursionSeconds: 20,
  fireOilLimit: 0.9,
  fireChancePerPastry: 0.03,
  fireChancePerOilChange: 0.05,
  fireSeconds: 20,
  repair: 80,
  burnedChancePerTake: 0.02,
  burnedSeconds: 30,
  annulEveryDays: 5,
} as const;
