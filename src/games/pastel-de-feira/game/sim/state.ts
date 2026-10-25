import type { ConsumableId, IngredientId } from '../data/catalog';
import type { ItemId } from '../data/recipes';
import { Rng } from '../rng';
import type { SurpriseEvent } from '../data/events';
import type { CourseId, PositionId, StaffKind, TraitId } from '../data/staff';
import type { Command, DayConfig, HoldAction, ItemRef, Profile, SimEvent, StationId, StockLot } from '../types';

export interface OrderLine {
  /** Item desejado. Muda só na troca automática (RN-35). */
  item: ItemId;
  /** Perfil de quem pediu este item (grupos têm perfis diferentes, spec seção 4). */
  profile?: Profile;
  /** Pastel de brinde: não paga, dá encanto na entrega (RN-120, RN-122). */
  gift?: boolean;
  /** Item entregue, quando já foi. */
  delivered: ItemId | null;
}

export type SeatState = 'livre' | 'ocupado' | 'sujo';

export interface Table {
  seats: SeatState[];
}

/** Grupo sentado numa mesa: um pedido conjunto, a paciência do mais impaciente (RN-85, RN-86). */
export interface GroupInfo {
  size: number;
  table: number;
  seats: number[];
  profiles: Profile[];
}

export interface Customer {
  id: number;
  profile: Profile;
  /** Teto de preço como fração da referência (perfil + reputação, RN-11/14). */
  ceiling: number;
  patience: number;
  patienceMax: number;
  lines: OrderLine[];
  /** `aguardando`: ainda não anotado. `anotado`: espera o pedido (RN-42). */
  state: 'aguardando' | 'anotado';
  arrivedAt: number;
  /** Já recebeu um item errado (RN-63). */
  wrong: boolean;
  /** A falha do pedido já foi registrada: cada pedido termina uma vez só (RN-61, RN-63). */
  failed: boolean;
  /** Algum item foi entregue abaixo da exigência de qualidade (RN-15). */
  lowQuality: boolean;
  /** Valor acumulado dos itens entregues (vira moeda no balcão quando o pedido fecha). */
  owed: number;
  /** Onde está: na fila do balcão, esperando na mesa, comendo ou na fila de pagamento (RN-83, RN-87). */
  place: 'fila' | 'mesa' | 'comendo' | 'pagamento';
  /** Quem atende o pedido: o balcão ou o garçom na mesa (RN-83). */
  service: 'balcao' | 'mesa';
  group?: GroupInfo;
  /** Segundos que faltam para terminar de comer (RN-82) ou para a paciência de pagamento (RN-87). */
  timer: number;
}

export interface Coin {
  id: number;
  amount: number;
}

/** Pastel montado na bancada, ainda sem fritar. */
export interface Assembled {
  id: number;
  item: ItemId;
  /** Bônus de nota de quem montou (Caprichoso, RN-114). */
  bonus?: number;
}

/** Pastel dentro de um cesto do tacho. */
export interface Frying {
  id: number;
  item: ItemId;
  /** Passos de fritura (inteiro: o ponto e a queima não acumulam erro de ponto flutuante). */
  ticks: number;
  burned: boolean;
  /** Alarmes já disparados (uma vez por pastel). */
  pontoAlerted: boolean;
  burnAlerted: boolean;
  bonus?: number;
}

export interface Basket {
  frying: Frying | null;
  /** Índice do cesto principal quando este cesto está ocupado pelo outro lado de um pastel grande (RN-30d). */
  shadow: number | null;
}

export interface Tacho {
  baskets: Basket[];
  oil: 'comum' | 'algodao';
  /** Sujeira do óleo, de 0 a 1 (RN-46). */
  dirt: number;
  /** Troca de óleo em andamento: progresso em segundos de 0 a HOLD_OIL_MANUAL. */
  changeProgress: number;
  /** Quanto dura a troca em andamento (s) e quem a faz: -1 o pasteleiro, id do funcionário, 0 ninguém. */
  changeTotal: number;
  changeBy: number;
  thermostat: boolean;
  alarm: boolean;
  timer: boolean;
  /** Segundos que faltam do fogo no tacho: parado, sem pastéis (RN-152). */
  fireLeft: number;
}

/** Pastel pronto, esperando entrega. A nota decai com o tempo (RN-25). */
export interface Ready {
  id: number;
  item: ItemId;
  /** Nota na saída do óleo, já com modificadores. */
  quality: number;
  readyAt: number;
  /** Reservado para uma comanda do app ou encomenda (RN-96, RN-104). */
  reservedFor?: number;
  /** Na caixa de encomenda: nota congelada por 60 s, sem ocupar a estufa (RN-104). */
  boxed?: boolean;
  /** Está na estufa: a nota fica congelada por 60 s (RN-27). */
  warmed?: boolean;
}

export interface Cup {
  id: number;
  item: ItemId;
}

export interface Pasteleiro {
  at: StationId;
  /** Destino em deslocamento, ou null. */
  to: StationId | null;
  moveLeft: number;
  /** Duração do deslocamento em curso (para animar a posição). */
  moveTotal: number;
  hold: { action: HoldAction; station: StationId; item?: ItemId } | null;
}

export type TaskKind = 'anotar' | 'cobrar' | 'pagar' | 'entregar' | 'montar' | 'colocar' | 'caldo' | 'trocar' | 'limpar' | 'varrer' | 'embalar';

export interface WorkerTask {
  kind: TaskKind;
  total: number;
  left: number;
  customerId?: number;
  ref?: ItemRef;
  item?: ItemId;
  tacho?: number;
}

/** Funcionário em ação no dia (RN-40, RN-43–45, RN-115). */
export interface Worker {
  id: number;
  name: string;
  kind: StaffKind;
  traits: TraitId[];
  courses: CourseId[];
  mode: 'fixo' | 'auto';
  /** Posição que o fixo prefere. */
  fixedPosition: PositionId | null;
  /** Posição em que trabalha agora (null: ocioso, descansando ou cedeu o lugar ao pasteleiro). */
  position: PositionId | null;
  energy: number;
  task: WorkerTask | null;
  /** Descansando: na área de descanso ou parado onde está (RN-116). */
  resting: 'area' | 'lugar' | null;
  /** O jogador mandou descansar (fixo, RN-116). */
  ordered: boolean;
  idleSeconds: number;
  restSeconds: number;
  minEnergy: number;
  /** Fora da barraca por um acidente (funcionário queimado, RN-152). */
  away: number;
}

export interface AppOffer {
  id: number;
  items: ItemId[];
  /** Segundos restantes de exibição (RN-91). */
  left: number;
}

export interface Comanda {
  id: number;
  items: ItemId[];
  /** Pastel pronto reservado para cada item, ou null. */
  packed: (number | null)[];
  /** Itens que são brinde (RN-120). */
  gifts: boolean[];
  /** Instante do dia (s) da retirada (RN-91). */
  pickupAt: number;
  motoboy: number | null;
}

export interface Motoboy {
  id: number;
  comandas: number[];
  waitLeft: number;
}

/** Encomenda em andamento no dia (RN-102, RN-104). */
export interface BigOrder {
  id: number;
  item: ItemId;
  qty: number;
  pickupAt: number;
  pay: number;
  fine: number;
  /** Pastéis prontos já na caixa da encomenda. */
  boxed: number[];
  state: 'pendente' | 'espera';
  waitLeft: number;
}

/** Estado dos eventos surpresa: no máximo 1 por dia (RN-150). */
export interface WorldState {
  /** Evento agendado para o dia (fiscal, energia, excursão), ou null. */
  kind: SurpriseEvent | null;
  /** Instante em segundos do dia. */
  at: number;
  fired: boolean;
  /** Já houve uma surpresa hoje (também cobre fogo e funcionário queimado). */
  used: boolean;
  powerLeft: number;
  excursionLeft: number;
  excursionGap: number;
  log: SurpriseEvent[];
  /** Pastéis que estavam na estufa quando a energia caiu. */
  pending: number[];
}

export interface Reputation {
  successes: number;
  charm: number;
  /** Soma dos pesos das falhas (RN-61). */
  failures: number;
}

export interface Stats {
  arrived: number;
  served: number;
  lostPatience: number;
  wrong: number;
  queueFull: number;
  lostPrice: number;
  noStock: number;
  burned: number;
  revenue: number;
  oilCost: number;
  repairs: number;
  tableRevenue: number;
  giftCost: number;
  /** Brindes entregues (balcão, mesa e app, RN-122). */
  gifts: number;
  drinks: number;
  especial: number;
  inspection: 'none' | 'passed' | 'failed';
  annulled: boolean;
  orderRevenue: number;
  fines: number;
  /** Parte de `fines` que veio do fiscal (RN-152); o resto é multa de encomenda (RN-104). */
  inspectionFines: number;
  encDone: number;
  encFailed: number;
  appRevenue: number;
  appPicked: number;
  appCancelled: number;
  lostDirt: number;
  payFail: number;
}

/** Estado mutável do Dia de Feira. Os arrays nunca são reatribuídos (o snapshot guarda referências). */
export interface DayState {
  config: DayConfig;
  seed: number;
  /** Passos executados. O tempo é `tick * STEP`. */
  tick: number;
  over: boolean;
  paused: boolean;
  /** Pausa do tutorial: o relógio e o resto do mundo param; comandos e deslocamento do pasteleiro continuam. */
  hold: boolean;
  speed: 1 | 2;
  rng: { customers: Rng; quality: Rng; staff: Rng; app: Rng; events: Rng };
  nextId: number;
  commands: Command[];
  seenGestures: Set<number>;
  rejected: number;
  events: SimEvent[];
  stock: StockLot[];
  consumables: Record<ConsumableId, number>;
  customers: Customer[];
  /** Grupos que já receberam o pedido e estão comendo. */
  bigOrders: BigOrder[];
  offers: AppOffer[];
  comandas: Comanda[];
  motoboys: Motoboy[];
  offerLeft: number;
  acceptedToday: number;
  /** Eventos surpresa do dia (RN-150, RN-152). */
  world: WorldState;
  /** Moenda automática: segundos que faltam do caldo em extração, ou 0 (RN-160). */
  autoMill: number;
  /** Avisos de evento para a tela, com tempo de exibição. */
  notices: { text: string; left: number }[];
  eating: Customer[];
  /** Fila de pagamento do balcão, separada da fila de pedidos (RN-87). */
  payQueue: Customer[];
  tables: Table[];
  /** Sujeira da barraca, de 0 a 100 (RN-130). */
  dirt: number;
  /** Progresso da limpeza que o pasteleiro faz segurando (mesa ou vassoura). */
  cleaning: { progress: number; table: number | null };
  arrivalLeft: number;
  coins: Coin[];
  /** Ingredientes clicados na bancada, ainda sem "fechar". */
  tray: IngredientId[];
  assembled: Assembled[];
  selectedAssembled: number | null;
  tachos: Tacho[];
  workers: Worker[];
  ready: Ready[];
  cups: Cup[];
  mill: { progress: number; item: ItemId | null };
  pasteleiro: Pasteleiro;
  rep: Reputation;
  stats: Stats;
}

export function createState(config: DayConfig, seed: number): DayState {
  const root = new Rng(seed);
  const rng = { customers: root.fork('clientes'), quality: root.fork('qualidade'), staff: root.fork('equipe'), app: root.fork('app'), events: root.fork('eventos') };
  return {
    config,
    seed: root.seed,
    tick: 0,
    over: false,
    paused: false,
    hold: false,
    speed: 1,
    rng,
    nextId: 1,
    commands: [],
    seenGestures: new Set(),
    rejected: 0,
    events: [],
    stock: config.stock.map((l) => ({ ...l })),
    consumables: { ...config.consumables },
    customers: [],
    bigOrders: config.orders.map((o) => ({ ...o, boxed: [], state: 'pendente' as const, waitLeft: 0 })),
    offers: [],
    comandas: [],
    motoboys: [],
    offerLeft: 10 + rng.customers.next() * 10,
    acceptedToday: 0,
    world: { kind: null, at: 0, fired: false, used: false, powerLeft: 0, excursionLeft: 0, excursionGap: 0, log: [], pending: [] },
    notices: [],
    autoMill: 0,
    eating: [],
    payQueue: [],
    tables: Array.from({ length: config.tables }, () => ({ seats: Array.from({ length: 4 }, () => 'livre' as SeatState) })),
    dirt: 0,
    cleaning: { progress: 0, table: null },
    arrivalLeft: 1 + rng.customers.next() * 3,
    coins: [],
    tray: [],
    assembled: [],
    selectedAssembled: null,
    tachos: config.tachos.map((t) => ({
      baskets: Array.from({ length: t.baskets }, () => ({ frying: null, shadow: null })),
      oil: t.oil,
      dirt: 0,
      changeProgress: 0,
      changeTotal: 0,
      changeBy: 0,
      thermostat: t.thermostat,
      alarm: t.alarm,
      timer: t.timer,
      fireLeft: 0,
    })),
    workers: config.staff.map((w) => ({
      id: w.id, name: w.name, kind: w.kind, traits: [...w.traits], courses: [...w.courses], mode: w.mode,
      fixedPosition: w.position, position: null, energy: 100, task: null, resting: null, ordered: false,
      idleSeconds: 0, restSeconds: 0, minEnergy: 100, away: 0,
    })),
    ready: [],
    cups: [],
    mill: { progress: 0, item: null },
    pasteleiro: { at: config.stations[0], to: null, moveLeft: 0, moveTotal: 0, hold: null },
    rep: { successes: 0, charm: 0, failures: 0 },
    stats: {
      arrived: 0, served: 0, lostPatience: 0, wrong: 0, queueFull: 0, lostPrice: 0, noStock: 0,
      burned: 0, revenue: 0, oilCost: 0, repairs: 0, tableRevenue: 0, giftCost: 0, gifts: 0, drinks: 0, especial: 0, inspection: 'none', annulled: false, orderRevenue: 0, fines: 0, inspectionFines: 0, encDone: 0, encFailed: 0, appRevenue: 0, appPicked: 0, appCancelled: 0, lostDirt: 0, payFail: 0,
    },
  };
}

export const now = (s: DayState): number => s.tick / 60;

export const newId = (s: DayState): number => s.nextId++;

export function emit(s: DayState, type: SimEvent['type'], id?: number): void {
  s.events.push({ type, t: now(s), id });
}
