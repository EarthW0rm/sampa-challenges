import {
  ARRIVAL_BASE_INTERVAL, ARRIVAL_DAILY_DECAY, ARRIVAL_MIN_INTERVAL, EXIGENTE_RAMP_END_HOUR,
  EXIGENTE_RAMP_FIRST_DAY, EXIGENTE_RAMP_LAST_DAY, EXIGENTE_RAMP_MAX_BONUS, EXIGENTE_RAMP_START_HOUR,
  FAIL_WEIGHT, LOW_REPUTATION_ARRIVAL, LOW_REPUTATION_LIMIT, ORDER_DESSERT_CHANCE, ORDER_DESSERT_CHANCE_LATE, ORDER_DESSERT_LATE_HOUR, ORDER_DRINK_CHANCE, ORDER_PASTRIES_MAX,
  ORDER_PASTRIES_MIN, PATIENCE, PEAK_END_HOUR, PEAK_FACTOR, PEAK_START_HOUR, PROFILE_CEILING,
  PROFILE_MIX_BASE, PROFILE_MIX_EXPENSIVE, PROFILE_MIX_PRICE_INDEX, QUEUE_MAX, REPUTATION_CEILING_BONUS, hourAt,
} from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import type { DayConfig, MenuEntry, Profile } from '../types';
import { recordFailure } from './reputation';
import { canMake, unitsMakeable } from './stock';
import { emit, newId, now, type Customer, type DayState } from './state';

const EPS = 1e-9;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const PROFILES: readonly Profile[] = ['economico', 'padrao', 'exigente'];

/** Faixa de estrelas que vale para prêmios e tetos: 5, 4 ou abaixo de 4 (RN-14, RN-22). */
export const starTier = (rep: number): 0 | 4 | 5 => (rep >= 5 ? 5 : rep >= 4 ? 4 : 0);

/** Teto de preço do perfil como fração da referência, com o bônus de reputação (RN-11, RN-14). */
export const ceilingFor = (profile: Profile, rep: number): number =>
  PROFILE_CEILING[profile] * (1 + (REPUTATION_CEILING_BONUS[starTier(rep)] ?? 0));

export const menuEntry = (s: DayState, item: ItemId): MenuEntry | undefined =>
  s.config.menu.find((m) => m.item === item);

/** Índice médio de preço do cardápio: preço de venda ÷ referência (RN-12). */
export function priceIndex(config: DayConfig): number {
  if (config.menu.length === 0) return 1;
  let sum = 0;
  for (const m of config.menu) sum += m.price / ITEMS[m.item].reference;
  return sum / config.menu.length;
}

/** Mistura de perfis para o dia, a hora e o índice de preço (RN-12, RN-19). Soma 1. */
export function profileShares(day: number, hour: number, index: number): Record<Profile, number> {
  const t = clamp01((index - 1) / (PROFILE_MIX_PRICE_INDEX - 1));
  let eco = lerp(PROFILE_MIX_BASE.economico, PROFILE_MIX_EXPENSIVE.economico, t);
  let pad = lerp(PROFILE_MIX_BASE.padrao, PROFILE_MIX_EXPENSIVE.padrao, t);
  let exi = lerp(PROFILE_MIX_BASE.exigente, PROFILE_MIX_EXPENSIVE.exigente, t);
  if (day >= EXIGENTE_RAMP_FIRST_DAY) {
    const bonus =
      EXIGENTE_RAMP_MAX_BONUS * clamp01((day - EXIGENTE_RAMP_FIRST_DAY) / (EXIGENTE_RAMP_LAST_DAY - EXIGENTE_RAMP_FIRST_DAY));
    const curve = clamp01((hour - EXIGENTE_RAMP_START_HOUR) / (EXIGENTE_RAMP_END_HOUR - EXIGENTE_RAMP_START_HOUR));
    const extra = exi * bonus * curve;
    exi += extra;
    const fromEco = Math.min(eco, extra);
    eco -= fromEco;
    pad -= extra - fromEco;
  }
  return { economico: eco, padrao: Math.max(0, pad), exigente: exi };
}

/** Intervalo médio entre chegadas agora, em segundos (RN-02, RN-03). */
export function arrivalInterval(s: DayState): number {
  let interval = Math.max(
    ARRIVAL_MIN_INTERVAL,
    ARRIVAL_BASE_INTERVAL * Math.pow(1 - ARRIVAL_DAILY_DECAY, s.config.day - 1),
  );
  const hour = hourAt(now(s));
  if (hour >= PEAK_START_HOUR && hour < PEAK_END_HOUR) interval /= PEAK_FACTOR;
  if (s.config.reputation < LOW_REPUTATION_LIMIT) interval /= LOW_REPUTATION_ARRIVAL;
  return interval;
}

const nextArrival = (s: DayState): number => arrivalInterval(s) * (0.5 + s.rng.customers.next());

/** O item cabe no teto do cliente? (RN-13) */
const affordable = (m: MenuEntry, ceiling: number): boolean => m.price <= ceiling * ITEMS[m.item].reference + EPS;

/** Cria o cliente na fila (usado pela chegada e pelos cenários). */
export function addCustomer(s: DayState, profile: Profile, items: readonly ItemId[]): Customer {
  const patience = PATIENCE[profile];
  const c: Customer = {
    id: newId(s),
    profile,
    ceiling: ceilingFor(profile, s.config.reputation),
    patience,
    patienceMax: patience,
    lines: items.map((item) => ({ item, delivered: null })),
    state: 'aguardando',
    arrivedAt: now(s),
    wrong: false,
    failed: false,
    lowQuality: false,
    owed: 0,
  };
  s.customers.push(c);
  return c;
}

export function removeCustomer(s: DayState, c: Customer): void {
  const i = s.customers.indexOf(c);
  if (i >= 0) s.customers.splice(i, 1);
}

/** Registra a falha do pedido, uma vez só. */
export function failOrder(s: DayState, c: Customer, weight: number): void {
  if (c.failed) return;
  c.failed = true;
  recordFailure(s, weight);
}

/** Chegada de um cliente (RN-04, RN-05, RN-12, RN-13). */
export function spawnCustomer(s: DayState): void {
  const rng = s.rng.customers;
  s.stats.arrived++;
  if (s.customers.length >= QUEUE_MAX) {
    s.stats.queueFull++;
    recordFailure(s, FAIL_WEIGHT.queueFull);
    emit(s, 'cliente_perdido_fila');
    return;
  }
  const shares = profileShares(s.config.day, hourAt(now(s)), priceIndex(s.config));
  const profile = rng.weighted(PROFILES, (p) => shares[p]) ?? 'padrao';
  const ceiling = ceilingFor(profile, s.config.reputation);

  const available = s.config.menu.filter((m) => canMake(s, ITEMS[m.item]));
  const pastries = available.filter((m) => ITEMS[m.item].kind === 'salgado' && affordable(m, ceiling));
  const desserts = available.filter((m) => ITEMS[m.item].kind === 'doce' && affordable(m, ceiling));
  const drinks = available.filter((m) => ITEMS[m.item].kind === 'bebida' && affordable(m, ceiling));
  if (pastries.length === 0) {
    const anyPastry = available.some((m) => ITEMS[m.item].kind === 'salgado');
    if (anyPastry) {
      s.stats.lostPrice++;
      emit(s, 'cliente_perdido_preco');
    } else {
      s.stats.noStock++;
      recordFailure(s, FAIL_WEIGHT.noStock);
      emit(s, 'cliente_perdido_estoque');
    }
    return;
  }
  const items: ItemId[] = [];
  const n = rng.int(ORDER_PASTRIES_MIN, ORDER_PASTRIES_MAX);
  for (let i = 0; i < n; i++) items.push(rng.weighted(pastries, (m) => m.weight ?? 1)!.item);
  const dessertChance = hourAt(now(s)) >= ORDER_DESSERT_LATE_HOUR ? ORDER_DESSERT_CHANCE_LATE : ORDER_DESSERT_CHANCE;
  if (desserts.length > 0 && rng.chance(dessertChance)) items.push(rng.weighted(desserts, (m) => m.weight ?? 1)!.item);
  if (drinks.length > 0 && rng.chance(ORDER_DRINK_CHANCE)) items.push(rng.weighted(drinks, (m) => m.weight ?? 1)!.item);
  const c = addCustomer(s, profile, items);
  emit(s, 'cliente_chegou', c.id);
}

/** Unidades do item já em produção ou prontas (cobrem pedidos antes da troca de RN-35). */
function supplyOf(s: DayState, id: ItemId): number {
  let n = 0;
  for (const a of s.assembled) if (a.item === id) n++;
  for (const t of s.tachos) for (const b of t.baskets) if (b.frying && !b.frying.burned && b.frying.item === id) n++;
  for (const r of s.ready) if (r.item === id) n++;
  for (const cup of s.cups) if (cup.item === id) n++;
  return n;
}

function chooseSubstitute(s: DayState, c: Customer, wanted: ItemId): ItemId | null {
  const x = ITEMS[wanted];
  const xPrice = menuEntry(s, wanted)?.price ?? Infinity;
  const options = s.config.menu.filter((m) => {
    const it = ITEMS[m.item];
    return m.item !== wanted && it.category === x.category && canMake(s, it);
  });
  if (c.profile === 'economico') {
    const ok = options.filter((m) => affordable(m, c.ceiling));
    ok.sort((a, b) => unitsMakeable(s, ITEMS[b.item]) - unitsMakeable(s, ITEMS[a.item]) || a.price - b.price || (a.item < b.item ? -1 : 1));
    return ok[0]?.item ?? null;
  }
  if (c.profile === 'padrao') {
    const ok = options.filter((m) => m.price <= xPrice + EPS);
    ok.sort((a, b) => b.price - a.price || unitsMakeable(s, ITEMS[b.item]) - unitsMakeable(s, ITEMS[a.item]) || (a.item < b.item ? -1 : 1));
    return ok[0]?.item ?? null;
  }
  return null;
}

/**
 * Troca automática quando um sabor acaba (RN-18, RN-35). Só a simulação troca: não existe comando.
 * Pedidos que excedem o que já está em produção reagem pelo perfil; idempotente.
 */
export function swapDemand(s: DayState): void {
  for (const m of s.config.menu) {
    const item = ITEMS[m.item];
    if (canMake(s, item)) continue;
    const demand: { c: Customer; line: Customer['lines'][number] }[] = [];
    for (const c of s.customers) for (const line of c.lines) if (line.delivered === null && line.item === m.item) demand.push({ c, line });
    demand.sort((a, b) => a.c.arrivedAt - b.c.arrivedAt || a.c.id - b.c.id);
    const gone = new Set<Customer>();
    for (const { c, line } of demand.slice(supplyOf(s, m.item))) {
      if (gone.has(c)) continue;
      const sub = chooseSubstitute(s, c, m.item);
      if (sub) {
        line.item = sub;
        emit(s, 'troca_sabor', c.id);
      } else {
        gone.add(c);
        s.stats.noStock++;
        failOrder(s, c, FAIL_WEIGHT.noStock);
        removeCustomer(s, c);
        emit(s, 'cliente_perdido_estoque', c.id);
      }
    }
  }
}

/** Chegadas e paciência. A paciência corre até o pedido completo ser recebido (RN-06). */
export function updateCustomers(s: DayState, dt: number): void {
  s.arrivalLeft -= dt;
  while (s.arrivalLeft <= 0) {
    spawnCustomer(s);
    s.arrivalLeft += nextArrival(s);
  }
  for (let i = s.customers.length - 1; i >= 0; i--) {
    const c = s.customers[i];
    c.patience -= dt;
    if (c.patience <= 0) {
      s.stats.lostPatience++;
      failOrder(s, c, FAIL_WEIGHT.counter);
      s.customers.splice(i, 1);
      emit(s, 'paciencia_esgotou', c.id);
    }
  }
}
