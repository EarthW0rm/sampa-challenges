/** Equipe: tipos, traços, cursos, posições e tempos (RN-40, RN-43, RN-47–49, RN-113–118). Valores (P). */

export type StaffKind = 'fritador' | 'geral';
export type TraitId = 'rapido' | 'caprichoso' | 'resistente' | 'distraido' | 'pavio-curto';
export type CourseId = 'fritura' | 'atendimento' | 'higiene';

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  /** Multiplicador do salário (RN-114). */
  salary: number;
}

// RN-114
export const TRAITS: Readonly<Record<TraitId, TraitDef>> = Object.freeze({
  rapido: { id: 'rapido', name: 'Rápido', desc: 'Tempos −15%', salary: 1.15 },
  caprichoso: { id: 'caprichoso', name: 'Caprichoso', desc: 'Nota +5 no que monta ou frita', salary: 1.1 },
  resistente: { id: 'resistente', name: 'Resistente', desc: 'Cansa 40% menos', salary: 1.1 },
  distraido: { id: 'distraido', name: 'Distraído', desc: '5% de chance de errar o sabor', salary: 0.85 },
  'pavio-curto': { id: 'pavio-curto', name: 'Pavio curto', desc: 'Reivindica 2× mais', salary: 0.9 },
});
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export interface CourseDef {
  id: CourseId;
  name: string;
  desc: string;
  price: number;
}

// RN-118
export const COURSES: Readonly<Record<CourseId, CourseDef>> = Object.freeze({
  fritura: { id: 'fritura', name: 'Boas Práticas de Fritura', desc: 'Nota +5 no que frita, troca de óleo 30% mais rápida, sem risco de fogo', price: 120 },
  atendimento: { id: 'atendimento', name: 'Atendimento', desc: 'Balcão, Garçom e Expedição 20% mais rápidos; clientes +5% de paciência', price: 100 },
  higiene: { id: 'higiene', name: 'Higiene', desc: 'Sujeira gerada −30% e limpeza 30% mais rápida', price: 80 },
});
export const COURSE_IDS = Object.keys(COURSES) as CourseId[];

// RN-47: salário diário base
export const SALARY: Readonly<Record<StaffKind, number>> = { fritador: 75, geral: 55 };

/** Candidatos por tipo a cada dia (RN-113). */
export const CANDIDATES_PER_KIND = 3;
/** Chance de 0, 1 ou 2 traços (P). */
export const TRAIT_COUNT_WEIGHTS: readonly number[] = [0.3, 0.45, 0.25];

export type PositionId =
  | 'balcao'
  | 'colocador1' | 'colocador2' | 'colocador3'
  | 'fritador1' | 'fritador2' | 'fritador3'
  | 'trocador'
  | 'moenda'
  | 'garcom'
  | 'ajudante'
  | 'expedicao';

export const POSITION_LABEL: Readonly<Record<PositionId, string>> = {
  balcao: 'Balcão', colocador1: 'Colocador 1', colocador2: 'Colocador 2', colocador3: 'Colocador 3',
  fritador1: 'Fritador 1', fritador2: 'Fritador 2', fritador3: 'Fritador 3', trocador: 'Trocador de óleo',
  moenda: 'Moenda', garcom: 'Garçom', ajudante: 'Ajudante', expedicao: 'Expedição',
};

/** Posições que só o tipo Fritador ocupa (RN-49). */
export const FRYER_ONLY: readonly PositionId[] = ['fritador1', 'fritador2', 'fritador3', 'trocador'];

/** Prioridade do modo automático (RN-45): Fritador > Balcão > Colocador > Moenda > Expedição > Garçom > Ajudante. */
export const AUTO_PRIORITY: readonly PositionId[] = [
  'fritador1', 'fritador2', 'fritador3', 'balcao', 'colocador1', 'colocador2', 'colocador3', 'moenda', 'expedicao', 'garcom', 'ajudante',
];

// RN-43: tempos de funcionário com energia ≥ 40 e sem traços (s)
export const WORK = {
  takeOrder: 1.5,
  assembleBase: 0.5,
  assemblePerStep: 1.5,
  place: 0.8,
  drinkExtra: 0.5,
  deliver: 1.5,
  collect: 1.5,
  oilChange: 10,
  cleanTable: 3,
} as const;

// RN-114, RN-115, RN-118
export const RAPID_FACTOR = 0.85;
export const ATTENDANCE_FACTOR = 0.8;
export const OIL_COURSE_FACTOR = 0.7;
export const WRONG_FLAVOR_CHANCE = 0.05;
export const CARE_BONUS = 5;
export const FRY_COURSE_BONUS = 5;
export const PATIENCE_COURSE_BONUS = 0.05;
export const RESISTANT_FATIGUE = 0.6;

// RN-115, RN-116: energia
export const ENERGY = {
  start: 100,
  drainPerSecond: 0.5,
  tiredBelow: 40,
  tiredFactor: 1.25,
  exhaustedBelow: 15,
  exhaustedFactor: 1.6,
  restBelow: 25,
  restUntil: 80,
  restAreaRate: 4,
  restPlaceRate: 1,
} as const;

// RN-117: área de descanso
export const REST_AREA = { price: 120, space: 1, firstSlots: 2, slotPrice: 80, maxSlots: 4 } as const;

/** Nomes de cachorro para a equipe (só enfeite; o id é o que vale). */
export const STAFF_NAMES: readonly string[] = [
  'Totó', 'Pipoca', 'Bolinha', 'Thor', 'Mel', 'Nina', 'Duque', 'Pingo', 'Fofão', 'Rex', 'Lupi', 'Bidu',
  'Tobias', 'Amora', 'Churros', 'Biscoito', 'Farofa', 'Jujuba', 'Maria Mole', 'Paçoca',
];
