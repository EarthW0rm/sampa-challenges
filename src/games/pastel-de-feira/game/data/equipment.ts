/** Equipamentos, espaço e placas de cardápio (RN-30b, RN-71–73). Valores (P): calibrados pela simulação. */

export type EquipId =
  | 'oleo-algodao'
  | 'escorredor'
  | 'embalagem-termica'
  | 'estufa'
  | 'estufa-grande'
  | 'moenda-motorizada'
  | 'conta-parceira'
  | 'moenda-automatica'
  | 'maquininha';

export interface EquipDef {
  id: EquipId;
  name: string;
  desc: string;
  price: number;
  /** Primeiro dia em que aparece para compra. */
  minDay: number;
  /** Equipamentos que precisam ser comprados antes. */
  requires: readonly EquipId[];
}

// RN-73
export const EQUIPMENT: Readonly<Record<EquipId, EquipDef>> = Object.freeze({
  'oleo-algodao': { id: 'oleo-algodao', name: 'Óleo de algodão', desc: 'Nota +10, suja menos (3% por pastel). Troca custa R$ 45.', price: 300, minDay: 1, requires: [] },
  escorredor: { id: 'escorredor', name: 'Escorredor profissional', desc: 'Nota +10 em todo pastel frito.', price: 250, minDay: 1, requires: [] },
  'embalagem-termica': { id: 'embalagem-termica', name: 'Embalagem térmica', desc: 'Pedidos do app não perdem nota no transporte.', price: 250, minDay: 1, requires: [] },
  estufa: { id: 'estufa', name: 'Estufa de vidro', desc: 'Guarda 6 pastéis prontos com a nota congelada por 60 s.', price: 300, minDay: 1, requires: [] },
  'estufa-grande': { id: 'estufa-grande', name: 'Estufa grande', desc: 'A estufa passa a guardar 12 pastéis.', price: 350, minDay: 1, requires: ['estufa'] },
  'conta-parceira': { id: 'conta-parceira', name: 'Conta Parceira do app', desc: '+4 comandas aceitas por dia (precisa da área de delivery).', price: 400, minDay: 1, requires: [] },
  'moenda-automatica': { id: 'moenda-automatica', name: 'Moenda automática', desc: 'Extrai um caldo por pedido anotado, sozinha. Substitui a Moenda (Geral, R$ 55/dia). Precisa da moenda motorizada.', price: 900, minDay: 1, requires: ['moenda-motorizada'] },
  maquininha: { id: 'maquininha', name: 'Maquininha de cartão', desc: 'Cobra sozinha o balcão e a fila de pagamento. Substitui parte do Balcão (Geral, R$ 55/dia).', price: 300, minDay: 1, requires: [] },
  'moenda-motorizada': { id: 'moenda-motorizada', name: 'Moenda motorizada', desc: 'Caldo em 2,5 s em vez de 6 s.', price: 500, minDay: 1, requires: [] },
});

export const EQUIP_IDS = Object.keys(EQUIPMENT) as EquipId[];

/** Compras por tacho e estruturas (RN-72, RN-73). */
export const TACHO = {
  extraPrice: 350,
  extraSpace: 2,
  max: 3,
  /** Cesto avulso (RN-73): +1 cesto no primeiro tacho com menos de `maxBaskets`. */
  basketPrice: 200,
  baseBaskets: 2,
  maxBaskets: 4,
  alarmPrice: 60,
  thermostatPrice: 350,
  timerPrice: 600,
} as const;

export const COOLER = { price: 200, space: 1, max: 2 } as const;

/** Metros quadrados (RN-71): R$ 120 na compra e R$ 8 por dia por m² extra. */
export const SPACE = { base: 6, max: 24, price: 120, dailyFee: 8 } as const;

/** Placas de cardápio (RN-30b): salgados de 4 a 7 vagas, doces de 2 para 3. */
export const MENU_BOARDS = {
  salgado: { first: 3, last: 7, prices: [150, 300, 450, 600] as readonly number[] },
  doce: { first: 2, last: 3, prices: [150] as readonly number[] },
} as const;

/** Propriedades do termostato (RN-73): janela do ponto +50% e queima +3 s. */
export const THERMOSTAT = { pontoMult: 1.5, burnExtra: 3 } as const;

/** Estufa (RN-27). */
export const WARMER = { capacity: 6, largeCapacity: 12, holdSeconds: 60, decayPerSecond: 1 } as const;

/** Bônus de nota dos equipamentos de fritura (RN-24). */
export const QUALITY_BONUS = { cotton: 10, drainer: 10 } as const;

/** Tempo de extração da moenda motorizada (RN-42). */
export const MILL_MOTOR_SECONDS = 2.5;

/** Mesas (RN-72, RN-80): R$ 150, 4 lugares, 2 m², no máximo 4. */
export const TABLE = { price: 150, space: 2, max: 4 } as const;

/** Área de delivery (RN-90): R$ 600, 3 m², a partir do dia 5. */
export const DELIVERY = { price: 600, space: 3, minDay: 5 } as const;
