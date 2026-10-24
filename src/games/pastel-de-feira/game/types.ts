import type { ConsumableId, IngredientId } from './data/catalog';
import type { Forecast, Season } from './data/events';
import type { OfficeRole } from './data/office';
import type { CourseId, PositionId, StaffKind, TraitId } from './data/staff';
import type { ItemId } from './data/recipes';

/** Tipos compartilhados entre simulação, campanha e apresentação (plan.md 3.2). */

export type Profile = 'economico' | 'padrao' | 'exigente';

export type StationId =
  | 'balcao'
  | 'bancada'
  | 'tacho1'
  | 'tacho2'
  | 'tacho3'
  | 'estufa'
  | 'moenda'
  | 'mesas'
  | 'expedicao'
  | 'escritorio'
  | 'descanso';

export type HoldAction = 'moenda' | 'oleo' | 'limpar';

/** Alvo de um toque dentro do painel de uma estação. */
export type Slot =
  | { k: 'anotar' }
  | { k: 'moedas' }
  | { k: 'ingrediente'; id: IngredientId }
  | { k: 'fechar' }
  | { k: 'limpar' }
  | { k: 'montado'; id: number }
  | { k: 'pagar' }
  | { k: 'encomenda'; id: number }
  | { k: 'cesto'; index: number }
  | { k: 'pronto'; id: number };

/** Item pronto que pode ser entregue a um cliente. */
export type ItemRef = { kind: 'pastel' | 'copo'; id: number };

/**
 * A única entrada do jogador na simulação. `g` é o id do gesto: o mesmo id é processado uma vez
 * só (toque duplo não cobra nem entrega em dobro).
 */
export type Command =
  | { type: 'tapStation'; station: StationId; g?: number }
  | { type: 'tapSlot'; station: StationId; slot: Slot; g?: number }
  | { type: 'holdStart'; station: StationId; action: HoldAction; item?: ItemId; g?: number }
  | { type: 'holdEnd'; g?: number }
  | { type: 'deliver'; item: ItemRef; customerId: number; g?: number }
  | { type: 'sendRest'; staffId: number; g?: number }
  | { type: 'acceptOffer'; offerId: number; g?: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setSpeed'; speed: 1 | 2 };

/** Item do cardápio do dia com o preço de venda escolhido no Preparo (RN-10). */
export interface MenuEntry {
  item: ItemId;
  price: number;
  /** Procura relativa do item (fadiga de cardápio, RN-30c). Padrão 1. */
  weight?: number;
}

/** Lote de insumo em estoque. `daysLeft` = dias de validade restantes (massa: até 3, RN-34). */
export interface StockLot {
  ingredient: IngredientId;
  qty: number;
  daysLeft: number;
}

export interface TachoConfig {
  /** Cestos: 2 (pequeno) ou 4 (grande). */
  baskets: number;
  oil: 'comum' | 'algodao';
  /** Janela do ponto +50% e queima +3 s (RN-73). */
  thermostat: boolean;
  /** Aviso quando o pastel entra no ponto e 1 s antes de queimar (RN-73). */
  alarm: boolean;
  /** Cesto com timer: tira sozinho no meio da janela (RN-160, US-119). */
  timer: boolean;
}

/** Funcionário que entra no dia (campanha → simulação). */
export interface StaffConfig {
  id: number;
  name: string;
  kind: StaffKind;
  traits: TraitId[];
  courses: CourseId[];
  mode: 'fixo' | 'auto';
  position: PositionId | null;
}

/** Encomenda aceita no Preparo: quantidade, horário de retirada, pagamento e multa (RN-102). */
export interface OrderConfig {
  id: number;
  item: ItemId;
  qty: number;
  /** Instante da retirada em segundos do dia. */
  pickupAt: number;
  pay: number;
  fine: number;
}

/** Equipamentos globais que o dia usa. */
export interface EquipmentFlags {
  /** Escorredor profissional: nota +10 (RN-24). */
  drainer: boolean;
  /** Vagas da estufa: 0 (sem), 6 ou 12 (RN-27). */
  warmer: number;
  mill: 'manual' | 'motorizada';
  /** Embalagem térmica do app (RN-25). */
  thermalBag: boolean;
}

/** Campanha → simulação. Imutável durante o dia. */
export interface DayConfig {
  day: number;
  /** Reputação inicial, de 1,0 a 5,0. */
  reputation: number;
  menu: MenuEntry[];
  stock: StockLot[];
  consumables: Record<ConsumableId, number>;
  /** Estações existentes, na ordem física usada para o deslocamento (RN-41). */
  stations: StationId[];
  tachos: TachoConfig[];
  equipment: EquipmentFlags;
  staff: StaffConfig[];
  /** Posições que existem na barraca (RN-40). */
  positions: PositionId[];
  /** Sujeira a partir da qual Exigentes não entram e a paciência cai (60; o tema Popular sobe para 75, RN-17). */
  dirtLimit?: number;
  /** Estação do ano (RN-140) e evento previsto do dia (RN-151). */
  season: Season;
  forecast: Forecast | null;
  /** Eventos ligados na campanha e a partir do dia 4 (RN-150). */
  eventsOn: boolean;
  /** O Despachante anula a multa de fiscalização deste dia (RN-103). */
  annulFine: boolean;
  /** Equipe recusada na reivindicação: −15% de velocidade no dia (RN-151). */
  claimRefused: boolean;
  /** Para testes e depuração: força um evento surpresa. */
  forceEvent?: string;
  /** Encomendas aceitas para hoje (RN-102). */
  orders: OrderConfig[];
  /** Cargos de gestão contratados (RN-103). */
  roles: OfficeRole[];
  /** Delivery do app: ligado hoje, aceite automático e Conta Parceira (RN-90, RN-95). */
  delivery: { on: boolean; auto: boolean; partner: boolean };
  /** Promoções do dia (RN-120, RN-123, RN-124). */
  promo: { brindeN: number; chorinho: number; xepa: boolean; xepaDiscount: number };
  /** Tema da barraca (RN-17). */
  theme: 'popular' | 'tradicional' | 'gourmet' | null;
  /** Mesas compradas, 0 a 4 (RN-80). */
  tables: number;
  /** Vagas da área de descanso, 0 sem área (RN-117). */
  restSlots: number;
  /** Caixas térmicas compradas (zona no layout). */
  coolers: number;
}

/** Fatos da simulação para som, partículas e depuração. Consumidos por `DaySim.drainEvents()`. */
export type SimEventType =
  | 'cliente_chegou'
  | 'cliente_perdido_preco'
  | 'cliente_perdido_fila'
  | 'cliente_perdido_estoque'
  | 'anotou'
  | 'montou'
  | 'colocou'
  | 'tirou_no_ponto'
  | 'tirou_cru'
  | 'tirou_passado'
  | 'queimou'
  | 'descartou'
  | 'oleo_trocado'
  | 'caldo_pronto'
  | 'alarme_ponto'
  | 'alarme_queima'
  | 'estufa'
  | 'funcionario_descansa'
  | 'funcionario_volta'
  | 'encomenda_chegou'
  | 'encomenda_entregue'
  | 'encomenda_falhou'
  | 'evento_inicio'
  | 'evento_fim'
  | 'oferta_app'
  | 'oferta_aceita'
  | 'moto_chegou'
  | 'comanda_embalada'
  | 'comanda_entregue'
  | 'comanda_cancelada'
  | 'grupo_sentou'
  | 'grupo_comendo'
  | 'grupo_pagou'
  | 'grupo_foi_embora'
  | 'mesa_limpa'
  | 'entregou'
  | 'item_errado'
  | 'cobrou'
  | 'paciencia_esgotou'
  | 'troca_sabor'
  | 'corte_seco';

export interface SimEvent {
  type: SimEventType;
  /** Instante do dia em segundos. */
  t: number;
  /** Id da entidade principal (cliente, pastel...), quando houver. */
  id?: number;
}

/** Resultado do dia (simulação → campanha). */
export interface DayResult {
  day: number;
  ticks: number;
  revenue: { counter: number; table: number; app: number; order: number; total: number };
  costs: { oil: number; fines: number; repairs: number };
  orders: {
    served: number;
    lostPatience: number;
    wrong: number;
    queueFull: number;
    lostPrice: number;
    noStock: number;
    lostDirt: number;
    payFail: number;
    appPicked: number;
    appCancelled: number;
    encDone: number;
    encFailed: number;
  };
  waste: { burned: number; leftover: number };
  reputation: { successes: number; charm: number; weightedFailures: number; rate: number; change: number };
  stockLeft: StockLot[];
  consumables: Record<ConsumableId, number>;
  /** Contadores do dia usados pelos desafios (RN-136). */
  counters: { drinks: number; especial: number; inspection: 'none' | 'passed' | 'failed'; annulled: boolean };
  /** Eventos surpresa que ocorreram (RN-152). */
  events: string[];
  /** Custo dos insumos dos brindes entregues (já incluído nos insumos usados). */
  giftCost: number;
  /** Resumo de cada funcionário no dia (energia, ociosidade). */
  staff: StaffDayResult[];
}

export interface StaffDayResult {
  id: number;
  idleSeconds: number;
  restSeconds: number;
  endEnergy: number;
  minEnergy: number;
}
