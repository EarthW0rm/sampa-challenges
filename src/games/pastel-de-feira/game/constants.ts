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
  economico: 90,
  padrao: 80,
  exigente: 70,
};

// RN-06b: quem está mais longe do balcão fica mais calmo: a paciência gasta menos a cada posição atrás do primeiro
export const QUEUE_CALM_STEP = 0.2;
export const QUEUE_CALM_MIN = 0.3;

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
export const DECAY_DELAY = 20;
export const DECAY_PER_SECOND = 1;
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
export const CHARM_GIFT = 1.5;
export const CHARM_CHORINHO = 0.1;
export const CHARM_INSPECTION = 2;
export const REPUTATION_TARGET_RATE = 0.75;
export const REPUTATION_RATE_GAIN = 2;
/** Ganho quando a taxa passa da meta: um dia perfeito (taxa 1) dá +1,0 estrela e a campanha consegue se recuperar. */
export const REPUTATION_RATE_GAIN_UP = 4;
export const REPUTATION_MAX_DAILY_CHANGE = 1;

// RN-38 / RN-34
export const STOCK_CAPACITY = 120;

/** Passos do dia inteiro (contador inteiro: o relógio não acumula erro de ponto flutuante). */
export const DAY_TICKS = Math.round(DAY_SECONDS / STEP);

// RN-80..87: mesas
export const TABLE_SEATS = 4;
export const TABLE_CHOICE = 0.3;
export const GROUP_WEIGHTS: readonly number[] = [0.4, 0.3, 0.2, 0.1];
export const TABLE_PATIENCE_FACTOR = 1.5;
export const TABLE_PREMIUM = 1.15;
export const EAT_SECONDS = 25;
export const PAY_QUEUE_MAX = 4;
export const PAY_PATIENCE = 20;

// RN-130..133: sujeira da barraca (0 a 100)
export const DIRT_MAX = 100;
export const DIRT_PER_ORDER = 1;
export const DIRT_PER_TABLE_CUSTOMER = 2;
export const DIRT_PER_BURNED = 3;
export const DIRT_PER_OIL_CHANGE = 5;
export const DIRT_PATIENCE_LIMIT = 60;
export const DIRT_PATIENCE_FACTOR = 0.8;
export const DIRT_FAIL_LIMIT = 80;
export const DIRT_FAIL_WEIGHT = 0.25;
export const HELPER_CLEAN_POINTS = 10;
export const HELPER_CLEAN_SECONDS = 3;
export const BROOM_POINTS = 25;
export const HYGIENE_DIRT_FACTOR = 0.7;
export const HYGIENE_CLEAN_FACTOR = 0.7;

// RN-90..96: delivery do app
export const APP_OFFER_INTERVAL = 25;
export const APP_OFFER_SECONDS = 10;
export const APP_PICKUP_DELAY = 35;
export const APP_MOTO_WAIT = 25;
export const APP_MOTO_WAIT_LOW_REP = 0.6;
export const APP_MOTO_MAX_ORDERS = 2;
export const APP_FEE = 0.2;
export const APP_TRANSPORT_LOSS = 20;
export const APP_ORDER_MIN = 2;
export const APP_ORDER_MAX = 4;
export const APP_CAP_BASE = 3;
export const APP_CAP_MID = 6;
export const APP_CAP_HIGH = 10;
export const APP_CAP_PARTNER = 4;

// RN-17, RN-120..125: promoções, xepa e tema
export const BRINDE_BUMP_LOW = 0.4;
export const BRINDE_BUMP_HIGH = 0.2;
export const BRINDE_MIN_N = 2;
export const BRINDE_MAX_N = 6;
export const CHORINHO_MAX = 3;
export const CHORINHO_DOSE = 0.1;
export const CHORINHO_SECONDS = 0.3;
export const XEPA_START_HOUR = 13;
export const XEPA_ECONOMIC_BOOST = 1.3;
export const XEPA_LEFTOVER_VALUE = 0.3;
export const XEPA_DISCOUNTS: readonly number[] = [0.1, 0.2, 0.3, 0.4, 0.5];
export const THEME_MIN_DAY = 5;
export const THEME_CHANGE_COST = 500;
export const THEME_MIX_SHIFT = 0.15;
export const THEME_DIRT_LIMIT_POPULAR = 75;
export const THEME_REPUTATION_BONUS = 1.1;
export const THEME_TABLE_PREMIUM_BONUS = 0.1;
export const THEME_QUALITY_BONUS = 10;

/**
 * Passos fixos a rodar num quadro de `dt` segundos reais na velocidade `speed` (1× ou 2×, RN-173).
 * Acelerar só roda mais passos por quadro: o `STEP` e as regras não mudam.
 */
export function stepsFor(acc: number, dt: number, speed: 1 | 2): { steps: number; acc: number } {
  let a = acc + dt * speed;
  let steps = 0;
  while (a >= STEP && steps < MAX_STEPS_PER_FRAME) {
    a -= STEP;
    steps++;
  }
  if (a > STEP * MAX_STEPS_PER_FRAME) a = 0; // queda de FPS: fica mais lento, sem pular regras
  return { steps, acc: a };
}

// RN-50: meta de lucro do dia N = GOAL_BASE × GOAL_GROWTH^(N−1) (calibrada pelos robôs, TF-123-02)
export const GOAL_BASE = 70;
export const GOAL_GROWTH = 1.12;
