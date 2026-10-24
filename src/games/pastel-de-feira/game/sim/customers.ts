import {
  ARRIVAL_BASE_INTERVAL, ARRIVAL_DAILY_DECAY, ARRIVAL_MIN_INTERVAL, EXIGENTE_RAMP_END_HOUR,
  EXIGENTE_RAMP_FIRST_DAY, EXIGENTE_RAMP_LAST_DAY, EXIGENTE_RAMP_MAX_BONUS, EXIGENTE_RAMP_START_HOUR,
  DIRT_PATIENCE_FACTOR, DIRT_PATIENCE_LIMIT, FAIL_WEIGHT, LOW_REPUTATION_ARRIVAL, LOW_REPUTATION_LIMIT, ORDER_DESSERT_CHANCE, ORDER_DESSERT_CHANCE_LATE, ORDER_DESSERT_LATE_HOUR, ORDER_DRINK_CHANCE, ORDER_PASTRIES_MAX,
  ORDER_PASTRIES_MIN, PATIENCE, PEAK_END_HOUR, PEAK_FACTOR, PEAK_START_HOUR, PROFILE_CEILING,
  PROFILE_MIX_BASE, PROFILE_MIX_EXPENSIVE, PROFILE_MIX_PRICE_INDEX, QUEUE_MAX, REPUTATION_CEILING_BONUS, TABLE_CHOICE, TABLE_PATIENCE_FACTOR, hourAt,
  BRINDE_BUMP_HIGH, BRINDE_BUMP_LOW, THEME_MIX_SHIFT, THEME_QUALITY_BONUS, TABLE_PREMIUM, THEME_TABLE_PREMIUM_BONUS, PROFILE_MIN_QUALITY, XEPA_ECONOMIC_BOOST, XEPA_START_HOUR,
} from '../constants';
import { ITEMS, itemIngredients, type ItemId } from '../data/recipes';
import { ingredientsCost } from '../data/catalog';
import type { DayConfig, MenuEntry, Profile } from '../types';
import { recordFailure } from './reputation';
import { drinkFactor, isRaining, seasonFx, tablesBlocked } from './world';
import { FORECAST } from '../data/events';
import { drawGroupSize, findTable, occupySeats, releaseSeats, waiterPresent } from './stations/tables';
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
export function profileShares(day: number, hour: number, index: number, theme: 'popular' | 'tradicional' | 'gourmet' | null = null): Record<Profile, number> {
  const t = clamp01((index - 1) / (PROFILE_MIX_PRICE_INDEX - 1));
  let eco = lerp(PROFILE_MIX_BASE.economico, PROFILE_MIX_EXPENSIVE.economico, t);
  let pad = lerp(PROFILE_MIX_BASE.padrao, PROFILE_MIX_EXPENSIVE.padrao, t);
  let exi = lerp(PROFILE_MIX_BASE.exigente, PROFILE_MIX_EXPENSIVE.exigente, t);
  if (theme === 'popular' || theme === 'gourmet') {
    // o tema desloca a mistura: o que um perfil ganha sai do Padrão e, se faltar, do outro (RN-17)
    const shift = Math.min(THEME_MIX_SHIFT, pad + (theme === 'popular' ? exi : eco));
    const fromPad = Math.min(pad, shift);
    pad -= fromPad;
    if (theme === 'popular') {
      eco += shift;
      exi -= shift - fromPad;
    } else {
      exi += shift;
      eco -= shift - fromPad;
    }
  }
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
  if (isRaining(s)) interval /= FORECAST.rainArrival; // chuva: chegada no balcão −40% (RN-151)
  if (xepaActive(s)) {
    // na xepa a chegada de Econômicos sobe 30%: o fluxo total cresce na proporção da fatia deles (RN-124)
    const eco = profileShares(s.config.day, hour, priceIndex(s.config), s.config.theme).economico;
    interval /= 1 + (XEPA_ECONOMIC_BOOST - 1) * eco;
  }
  return interval;
}

const nextArrival = (s: DayState): number => arrivalInterval(s) * (0.5 + s.rng.customers.next());

/** O item cabe no teto do cliente? (RN-13) */
/** A xepa vale das 13h às 14h, quando ligada (RN-124). */
export const xepaActive = (s: DayState): boolean => s.config.promo.xepa && hourAt(now(s)) >= XEPA_START_HOUR;

/** Preço de venda no balcão e na mesa: com o desconto da xepa quando ela vale. O app não tem xepa (RN-93). */
export const salePrice = (s: DayState, item: ItemId): number => {
  const base = menuEntry(s, item)?.price ?? ITEMS[item].reference;
  return xepaActive(s) ? Math.round(base * (1 - s.config.promo.xepaDiscount) * 100) / 100 : base;
};

const affordableAt = (s: DayState, m: MenuEntry, ceiling: number): boolean => salePrice(s, m.item) <= ceiling * ITEMS[m.item].reference + EPS;

/** Exigência de nota do perfil; o tema Gourmet soma 10 (RN-11, RN-17). */
export const minQuality = (s: DayState, profile: Profile): number =>
  PROFILE_MIN_QUALITY[profile] + (s.config.theme === 'gourmet' ? THEME_QUALITY_BONUS : 0);

/** Prêmio de mesa de 15%, +10% no tema Gourmet (RN-82, RN-17). */
export const tablePremium = (s: DayState): number => TABLE_PREMIUM + (s.config.theme === 'gourmet' ? THEME_TABLE_PREMIUM_BONUS : 0);

/** Pastel de brinde de um pedido: o de menor preço entre os pagos; sem insumo, um Tradicional de 1 etapa (RN-120, spec 4). */
export function giftFor(s: DayState, items: readonly ItemId[]): ItemId | null {
  const n = s.config.promo.brindeN;
  const paid = items.filter((i) => ITEMS[i].kind === 'salgado');
  if (n <= 0 || paid.length < n) return null;
  const cheapest = [...paid].sort((a, b) => salePrice(s, a) - salePrice(s, b))[0];
  if (canMake(s, ITEMS[cheapest])) return cheapest;
  const fallback = s.config.menu.map((m) => m.item).find((id) => ITEMS[id].category === 'tradicional' && ITEMS[id].steps === 1 && canMake(s, ITEMS[id]));
  return fallback ?? null;
}

/** Custo dos insumos de um item (para o custo dos brindes). */
export const itemCost = (id: ItemId): number => ingredientsCost(itemIngredients(ITEMS[id]));

/** Cria o cliente na fila (usado pela chegada e pelos cenários). */
export function addCustomer(s: DayState, profile: Profile, items: readonly ItemId[]): Customer {
  const patience = PATIENCE[profile] * (s.config.profile === 'boa-praca' ? 1.15 : 1); // Boa-praça: +15% de paciência (RN-110)
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
    place: 'fila',
    service: 'balcao',
    timer: 0,
  };
  s.customers.push(c);
  return c;
}

export function removeCustomer(s: DayState, c: Customer): void {
  const i = s.customers.indexOf(c);
  if (i >= 0) s.customers.splice(i, 1);
  if (c.place === 'fila' || c.place === 'mesa') releaseSeats(s, c, 'livre'); // quem desiste antes de comer deixa os lugares limpos
}

/** Registra a falha do pedido, uma vez só. */
export function failOrder(s: DayState, c: Customer, weight: number): void {
  if (c.failed) return;
  c.failed = true;
  recordFailure(s, weight);
}

/** Clientes na fila do balcão: grupos atendidos pelo garçom esperam na mesa, fora da fila (RN-04, RN-83). */
export const queueOf = (s: DayState): Customer[] => s.customers.filter((c) => c.place === 'fila');

interface Drawn {
  items: ItemId[];
  lost: 'price' | 'stock' | null;
}

/** Sorteia o pedido de um cliente: 1–2 pastéis, doce e caldo dentro do teto e do estoque (RN-05, RN-13, RN-30e). */
function drawOrder(s: DayState, profile: Profile): Drawn {
  const rng = s.rng.customers;
  const ceiling = ceilingFor(profile, s.config.reputation);
  const available = s.config.menu.filter((m) => canMake(s, ITEMS[m.item]));
  const pastries = available.filter((m) => ITEMS[m.item].kind === 'salgado' && affordableAt(s, m, ceiling));
  const desserts = available.filter((m) => ITEMS[m.item].kind === 'doce' && affordableAt(s, m, ceiling));
  const drinks = available.filter((m) => ITEMS[m.item].kind === 'bebida' && affordableAt(s, m, ceiling));
  if (pastries.length === 0) {
    return { items: [], lost: available.some((m) => ITEMS[m.item].kind === 'salgado') ? 'price' : 'stock' };
  }
  const items: ItemId[] = [];
  let n = rng.chance(Math.min(1, 0.5 * seasonFx(s).twoPastries)) ? ORDER_PASTRIES_MAX : ORDER_PASTRIES_MIN; // inverno: mais pedidos de 2 (RN-141)
  const promoN = s.config.promo.brindeN;
  if (promoN > 0 && n < promoN && rng.chance(promoN <= 3 ? BRINDE_BUMP_LOW : BRINDE_BUMP_HIGH)) n = promoN; // RN-121
  for (let i = 0; i < n; i++) items.push(rng.weighted(pastries, (m) => m.weight ?? 1)!.item);
  const dessertChance = hourAt(now(s)) >= ORDER_DESSERT_LATE_HOUR ? ORDER_DESSERT_CHANCE_LATE : ORDER_DESSERT_CHANCE;
  if (desserts.length > 0 && rng.chance(dessertChance)) items.push(rng.weighted(desserts, (m) => m.weight ?? 1)!.item);
  if (drinks.length > 0 && rng.chance(Math.min(1, ORDER_DRINK_CHANCE * drinkFactor(s)))) items.push(rng.weighted(drinks, (m) => m.weight ?? 1)!.item);
  return { items, lost: null };
}

function loseCustomer(s: DayState, lost: 'price' | 'stock'): void {
  if (lost === 'price') {
    s.stats.lostPrice++;
    emit(s, 'cliente_perdido_preco');
  } else {
    s.stats.noStock++;
    recordFailure(s, FAIL_WEIGHT.noStock);
    emit(s, 'cliente_perdido_estoque');
  }
}

/** Limiar de sujeira que afasta Exigentes e irrita todo mundo (RN-16, RN-133). */
export const dirtLimit = (s: DayState): number => s.config.dirtLimit ?? DIRT_PATIENCE_LIMIT;

/** Um cliente individual entra na fila do balcão (RN-04, RN-12, RN-13, RN-16). */
function spawnIndividual(s: DayState, profile: Profile): void {
  if (queueOf(s).length >= QUEUE_MAX) {
    s.stats.queueFull++;
    recordFailure(s, FAIL_WEIGHT.queueFull);
    emit(s, 'cliente_perdido_fila');
    return;
  }
  const order = drawOrder(s, profile);
  if (order.lost) return loseCustomer(s, order.lost);
  const c = addCustomer(s, profile, order.items);
  const gift = giftFor(s, order.items);
  if (gift) c.lines.push({ item: gift, delivered: null, gift: true });
  emit(s, 'cliente_chegou', c.id);
}

/** Membros extras de um grupo: só Padrão e Exigentes escolhem mesa (RN-81). */
function groupProfiles(s: DayState, leader: Profile, size: number): Profile[] {
  const shares = profileShares(s.config.day, hourAt(now(s)), priceIndex(s.config), s.config.theme);
  const out: Profile[] = [leader];
  while (out.length < size) out.push(s.rng.customers.weighted(['padrao', 'exigente'] as const, (p) => shares[p]) ?? 'padrao');
  return out;
}

/** Grupo na mesa: um pedido conjunto, cada item no perfil de quem pediu (RN-85, RN-86). Devolve false se não há mesa. */
function seatGroup(s: DayState, profiles: Profile[]): boolean {
  const size = profiles.length;
  const table = findTable(s, size);
  if (table < 0) return false;
  const byWaiter = waiterPresent(s);
  if (!byWaiter && queueOf(s).length >= QUEUE_MAX) {
    s.stats.queueFull++;
    recordFailure(s, FAIL_WEIGHT.queueFull);
    emit(s, 'cliente_perdido_fila');
    return true;
  }
  const lines: { item: ItemId; profile: Profile }[] = [];
  let lost: 'price' | 'stock' | null = null;
  for (const p of profiles) {
    const order = drawOrder(s, p);
    if (order.lost) lost = lost ?? order.lost;
    for (const item of order.items) lines.push({ item, profile: p });
  }
  if (lines.length === 0) {
    loseCustomer(s, lost ?? 'price');
    return true;
  }
  const c = addCustomer(s, profiles[0], lines.map((l) => l.item));
  c.lines.forEach((l, i) => (l.profile = lines[i].profile));
  const gift = giftFor(s, lines.map((l) => l.item));
  if (gift) c.lines.push({ item: gift, delivered: null, gift: true, profile: profiles[0] });
  const base = Math.min(...profiles.map((p) => PATIENCE[p])) * TABLE_PATIENCE_FACTOR * (s.config.profile === 'boa-praca' ? 1.15 : 1);
  c.patience = base;
  c.patienceMax = base;
  c.service = byWaiter ? 'mesa' : 'balcao';
  c.place = byWaiter ? 'mesa' : 'fila';
  c.group = { size, table, seats: occupySeats(s, table, size), profiles };
  emit(s, 'grupo_sentou', c.id);
  return true;
}

/** Chegada de um cliente ou grupo (RN-04, RN-05, RN-12, RN-13, RN-81, RN-85). */
export function spawnCustomer(s: DayState, forced?: Profile): void {
  const rng = s.rng.customers;
  s.stats.arrived++;
  const shares = profileShares(s.config.day, hourAt(now(s)), priceIndex(s.config), s.config.theme);
  const boost = xepaActive(s) ? XEPA_ECONOMIC_BOOST : 1; // na xepa chegam 30% mais Econômicos (RN-124)
  const profile = forced ?? rng.weighted(PROFILES, (p) => shares[p] * (p === 'economico' ? boost : 1)) ?? 'padrao';
  if (profile === 'exigente' && s.dirt >= dirtLimit(s)) {
    s.stats.lostDirt++; // Exigente não entra numa barraca suja (RN-16)
    return;
  }
  const tableChance = TABLE_CHOICE * (isRaining(s) ? FORECAST.rainTables : 1); // chuva: mesas com metade da procura (RN-151)
  if (s.tables.length > 0 && !tablesBlocked(s) && profile !== 'economico' && rng.chance(tableChance)) {
    const size = drawGroupSize(rng);
    const profiles = groupProfiles(s, profile, size);
    if (seatGroup(s, profiles)) return;
    // sem mesa livre e limpa para todos: o grupo vai para o balcão como clientes individuais (RN-85)
    for (const p of profiles) spawnIndividual(s, p);
    return;
  }
  spawnIndividual(s, profile);
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

function chooseSubstitute(s: DayState, profile: Profile, wanted: ItemId): ItemId | null {
  const ceiling = ceilingFor(profile, s.config.reputation);
  const x = ITEMS[wanted];
  const xPrice = salePrice(s, wanted);
  const options = s.config.menu.filter((m) => {
    const it = ITEMS[m.item];
    return m.item !== wanted && it.category === x.category && canMake(s, it);
  });
  if (profile === 'economico') {
    const ok = options.filter((m) => affordableAt(s, m, ceiling));
    ok.sort((a, b) => unitsMakeable(s, ITEMS[b.item]) - unitsMakeable(s, ITEMS[a.item]) || salePrice(s, a.item) - salePrice(s, b.item) || (a.item < b.item ? -1 : 1));
    return ok[0]?.item ?? null;
  }
  if (profile === 'padrao') {
    const ok = options.filter((m) => salePrice(s, m.item) <= xPrice + EPS);
    ok.sort((a, b) => salePrice(s, b.item) - salePrice(s, a.item) || unitsMakeable(s, ITEMS[b.item]) - unitsMakeable(s, ITEMS[a.item]) || (a.item < b.item ? -1 : 1));
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
      const sub = chooseSubstitute(s, line.profile ?? c.profile, m.item);
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
  // barraca suja: todos ficam 20% menos pacientes (RN-133)
  const drain = s.dirt >= dirtLimit(s) ? dt / DIRT_PATIENCE_FACTOR : dt;
  for (let i = s.customers.length - 1; i >= 0; i--) {
    const c = s.customers[i];
    c.patience -= drain;
    if (c.patience <= 0) {
      s.stats.lostPatience++;
      failOrder(s, c, FAIL_WEIGHT.counter);
      removeCustomer(s, c);
      emit(s, 'paciencia_esgotou', c.id);
    }
  }
}
