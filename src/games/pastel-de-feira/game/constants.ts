/**
 * Resolução lógica 640×480 (4:3), exceção à regra 7 do CLAUDE.md raiz (PA-15). O canvas tem
 * W·SCALE × H·SCALE = 1280×960 e os sprites ganham o dobro de detalhe com o Scale2x de `hires.ts`.
 *
 * Todo número de equilíbrio da simulação mora aqui ou em `data/*`. Os marcados (P) são
 * calibrados pela simulação sem tela (`sim/run.ts`). Cada bloco cita a regra da spec (RN-xx).
 */
export const W = 640;
export const H = 480;

/** Passo fixo da simulação (s). Acelerar 2× = 2 passos por quadro. */
export const STEP = 1 / 60;
/** Teto de passos por quadro: em queda de FPS o jogo fica mais lento, sem pular regras. */
export const MAX_STEPS_PER_FRAME = 5;
/** Teto do dt de um quadro (s). */
export const MAX_FRAME_DT = 0.05;

// RN-01: relógio
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 14;
/** Duração real do Dia de Feira em segundos (P). */
export const DAY_SECONDS = 240;
export const HOUR_SECONDS = DAY_SECONDS / (DAY_END_HOUR - DAY_START_HOUR);

/** Hora do relógio do jogo (7 a 14) para um instante do dia em segundos. */
export const hourAt = (t: number): number => DAY_START_HOUR + t / HOUR_SECONDS;

// RN-02: chegada
export const ARRIVAL_BASE_INTERVAL = 12;
export const ARRIVAL_DAILY_DECAY = 0.04;
export const ARRIVAL_MIN_INTERVAL = 4;
export const PEAK_START_HOUR = 10;
export const PEAK_END_HOUR = 12;
export const PEAK_FACTOR = 1.5;
// RN-03
export const LOW_REPUTATION_LIMIT = 2;
export const LOW_REPUTATION_ARRIVAL = 0.7;
// RN-04
export const QUEUE_MAX = 6;
// RN-05
export const ORDER_PASTRIES_MIN = 1;
export const ORDER_PASTRIES_MAX = 2;
export const ORDER_DRINK_CHANCE = 0.4;
// RN-30e: doce como sobremesa
export const ORDER_DESSERT_CHANCE = 0.25;
export const ORDER_DESSERT_CHANCE_LATE = 0.35;
export const ORDER_DESSERT_LATE_HOUR = 11;
// RN-06: paciência base (s) do fim da fila até receber o pedido completo
export const PATIENCE: Readonly<Record<'economico' | 'padrao' | 'exigente', number>> = {
  economico: 45,
  padrao: 40,
  exigente: 35,
};

// RN-10: faixa de preço (fração da referência) e passo (R$)
export const PRICE_MIN_FACTOR = 0.5;
export const PRICE_MAX_FACTOR = 2.5;
export const PRICE_STEP = 0.5;

// RN-11: teto de preço (× referência) e exigência de qualidade por perfil
export const PROFILE_CEILING: Readonly<Record<'economico' | 'padrao' | 'exigente', number>> = {
  economico: 0.9,
  padrao: 1.2,
  exigente: 1.6,
};
export const PROFILE_MIN_QUALITY: Readonly<Record<'economico' | 'padrao' | 'exigente', number>> = {
  economico: 30,
  padrao: 50,
  exigente: 70,
};
// RN-12: mistura base e mistura com preço médio >= PROFILE_MIX_PRICE_INDEX
export const PROFILE_MIX_BASE = { economico: 0.5, padrao: 0.4, exigente: 0.1 } as const;
export const PROFILE_MIX_EXPENSIVE = { economico: 0.2, padrao: 0.5, exigente: 0.3 } as const;
export const PROFILE_MIX_PRICE_INDEX = 1.3;
// RN-14: bônus de teto por estrela
export const REPUTATION_CEILING_BONUS: Readonly<Record<number, number>> = { 4: 0.1, 5: 0.2 };
// RN-19: Exigentes no fim do dia
export const EXIGENTE_RAMP_FIRST_DAY = 6;
export const EXIGENTE_RAMP_LAST_DAY = 20;
export const EXIGENTE_RAMP_MAX_BONUS = 1;
export const EXIGENTE_RAMP_START_HOUR = 10;
export const EXIGENTE_RAMP_END_HOUR = 12;

// RN-20..25: qualidade e valor
export const QUALITY_FACTOR_MIN = 0.8;
export const QUALITY_FACTOR_SPAN = 0.4;
export const REPUTATION_PREMIUM: Readonly<Record<number, number>> = { 4: 1.1, 5: 1.2 };
export const QUALITY_RAW = 40;
export const QUALITY_PONTO = 80;
export const QUALITY_OVERDONE = 55;
export const OIL_DIRTY_QUALITY_PENALTY = 15;
/** Sujeira do óleo a partir da qual ele conta como sujo (fração de 0 a 1). */
export const OIL_DIRTY_THRESHOLD = 0.7;
export const DECAY_DELAY = 10;
export const DECAY_PER_SECOND = 2;
export const NO_BAG_PENALTY = 10;

// RN-41..42: pasteleiro (s)
export const MOVE_NEIGHBOR = 0.4;
export const MOVE_EXTRA_STATION = 0.2;
export const HOLD_MILL_MANUAL = 6;
export const HOLD_OIL_MANUAL = 8;
export const HOLD_CLEAN_TABLE = 3;
export const HOLD_BROOM = 4;

/** Pastéis montados esperando na bancada e ingredientes no prato (P). */
export const BENCH_CAPACITY = 6;
export const BENCH_TRAY_MAX = 4;

// RN-46: óleo
export const OIL_DIRT_PER_PASTRY = 0.04;
export const OIL_DIRT_PER_PASTRY_COTTON = 0.03;
export const OIL_CHANGE_COST = 25;
export const OIL_CHANGE_COST_COTTON = 45;
export const OIL_LOCK_PERCENT = 1;

/** Cestos por tacho: pequeno 2, grande 4 (RN-73). */
export const BASKETS_SMALL = 2;
export const BASKETS_LARGE = 4;

// RN-61..62: reputação
export const FAIL_WEIGHT = {
  counter: 1,
  noStock: 0.5,
  queueFull: 0.5,
  appLate: 3,
  appLowQuality: 1,
  orderLate: 3,
  dirtyDelivery: 0.25,
  payment: 1,
} as const;
export const APP_LOW_QUALITY = 40;
export const CHARM_GIFT = 0.5;
export const CHARM_CHORINHO = 0.1;
export const CHARM_INSPECTION = 2;
export const REPUTATION_TARGET_RATE = 0.75;
export const REPUTATION_RATE_GAIN = 2;
export const REPUTATION_MAX_DAILY_CHANGE = 1;

// RN-38 / RN-34
export const STOCK_CAPACITY = 120;

/** Passos do dia inteiro (contador inteiro: o relógio não acumula erro de ponto flutuante). */
export const DAY_TICKS = Math.round(DAY_SECONDS / STEP);
