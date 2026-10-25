import { HELPER_CLEAN_POINTS, HELPER_CLEAN_SECONDS, HYGIENE_CLEAN_FACTOR, STEP } from '../constants';
import { FORECAST, SURPRISE } from '../data/events';
import { MANAGEMENT_SPEED, MANAGER_SPEED } from '../data/office';
import { AUTO_PRIORITY, ATTENDANCE_FACTOR, CARE_BONUS, ENERGY, FRYER_ONLY, FRY_COURSE_BONUS, OIL_COURSE_FACTOR, RAPID_FACTOR, RESISTANT_FATIGUE, WORK, WRONG_FLAVOR_CHANCE, type PositionId } from '../data/staff';
import { ITEMS, type ItemId } from '../data/recipes';
import type { ItemRef, StationId } from '../types';
import { lineMatches, deliverItem, noteOrder, takeCoins } from './stations/counter';
import { chargeGroup } from './stations/tables';
import { packPastry } from './delivery';
import { autoMillActive, cardMachineActive, timerActive } from './automation';
import { boxPastry } from './orders';
import { addDirt, cleanTable, dirtyTable } from './dirt';
import { assembleItem } from './stations/bench';
import { makeCup, millSeconds } from './stations/cane';
import { fryWindow, isChanging, nextFreeBasket, placeBasket, startWorkerOilChange, takeBasket } from './stations/fryer';
import { warmerCapacity, warmedCount, warmReady } from './stations/warmer';
import { currentQuality } from './quality';
import { fatigueFactor, ignite, maybeBurnWorker, canSurprise } from './world';
import { emit, now, type Customer, type DayState, type Worker, type WorkerTask } from './state';
import { canMake } from './stock';
import { BENCH_CAPACITY, OIL_DIRTY_THRESHOLD } from '../constants';
import { unmetItems } from './demand';

const EPS = 1e-9;

/**
 * Estação fixa da posição: o pasteleiro nessa estação toma o lugar de quem está lá (JA-01). O Fritador não
 * tem tacho fixo (assume um tacho livre, `fryerTachos`) e a Troca de óleo é volante.
 */
export function homeStation(pos: PositionId): StationId | null {
  if (pos === 'balcao') return 'balcao';
  if (pos.startsWith('montagem')) return 'bancada';
  if (pos === 'moenda') return 'moenda';
  if (pos === 'garcom' || pos === 'ajudante') return 'mesas';
  if (pos === 'expedicao') return 'expedicao';
  return null;
}

const pasteleiroStation = (s: DayState): StationId | null => (s.pasteleiro.to === null ? s.pasteleiro.at : null);

const tachoStation = (i: number): StationId => `tacho${i + 1}` as StationId;

/**
 * Tacho de cada Fritador (RN-40): os tachos sem o pasteleiro e sem fogo, em ordem, vão para os Fritadores em
 * ordem de posição. Fritador sem tacho livre fica parado.
 */
export function fryerTachos(s: DayState): Map<number, number> {
  const pst = pasteleiroStation(s);
  const free = s.tachos.map((_, i) => i).filter((i) => pst !== tachoStation(i) && s.tachos[i].fireLeft <= 0);
  const fryers = s.workers.filter((w) => w.position?.startsWith('fritador')).sort((a, b) => a.position!.localeCompare(b.position!));
  const out = new Map<number, number>();
  fryers.forEach((w, k) => {
    if (k < free.length) out.set(w.id, free[k]);
  });
  return out;
}

/** Onde o funcionário aparece agora: o tacho do Fritador, o tacho da troca de óleo ou a estação da posição. */
export function workerStation(s: DayState, w: Worker): StationId | null {
  if (!w.position) return null;
  if (w.position.startsWith('fritador')) {
    const t = fryerTachos(s).get(w.id);
    return t === undefined ? null : tachoStation(t);
  }
  if (w.position === 'trocador') return tachoStation(w.task?.kind === 'trocar' && w.task.tacho !== undefined ? w.task.tacho : 0);
  return homeStation(w.position);
}

const holderOf = (s: DayState, pos: PositionId): Worker | undefined => s.workers.find((w) => w.position === pos);

function vacant(s: DayState, pos: PositionId): boolean {
  if (!s.config.positions.includes(pos) || holderOf(s, pos)) return false;
  const home = homeStation(pos);
  return home === null || home !== pasteleiroStation(s);
}

const eligible = (w: Worker, pos: PositionId): boolean => !(FRYER_ONLY.includes(pos) && w.kind !== 'fritador');

/** Fator de tempo de um funcionário: traços e energia (RN-43, RN-114, RN-115). */
export function speedFactor(w: Worker): number {
  let f = 1;
  if (w.traits.includes('rapido')) f *= RAPID_FACTOR;
  if (w.energy < ENERGY.exhaustedBelow) f *= ENERGY.exhaustedFactor;
  else if (w.energy < ENERGY.tiredBelow) f *= ENERGY.tiredFactor;
  return f;
}

/** Bônus de nota de quem tira do óleo: Caprichoso e curso de Fritura (RN-114, RN-118). */
const fryBonus = (w: Worker): number => (w.traits.includes('caprichoso') ? CARE_BONUS : 0) + (w.courses.includes('fritura') ? FRY_COURSE_BONUS : 0);

function release(w: Worker, s: DayState): void {
  const t = w.task;
  w.position = null;
  w.task = null;
  if (t?.kind === 'trocar' && t.tacho !== undefined) {
    const tacho = s.tachos[t.tacho];
    if (tacho?.changeBy === w.id) {
      tacho.changeProgress = 0;
      tacho.changeBy = 0;
    }
  }
}

// ------------------------------------------------------------ descanso e energia

function usedRestSlots(s: DayState): number {
  return s.workers.filter((w) => w.resting === 'area').length;
}

function startRest(s: DayState, w: Worker): void {
  release(w, s);
  w.resting = s.config.restSlots > usedRestSlots(s) ? 'area' : 'lugar';
  emit(s, 'funcionario_descansa', w.id);
}

/** O jogador manda um funcionário fixo descansar (RN-116). Em automático ele descansa sozinho. */
export function sendToRest(s: DayState, staffId: number): boolean {
  const w = s.workers.find((x) => x.id === staffId);
  if (!w || w.mode !== 'fixo' || w.resting) return false;
  startRest(s, w);
  w.ordered = true;
  return true;
}

function updateEnergy(s: DayState, w: Worker, dt: number): void {
  if (w.away > 0) {
    w.away = Math.max(0, w.away - dt); // fora da barraca depois de um acidente (RN-152)
    return;
  }
  if (w.resting) {
    w.restSeconds += dt;
    w.energy = Math.min(100, w.energy + (w.resting === 'area' ? ENERGY.restAreaRate : ENERGY.restPlaceRate) * dt);
    if (w.energy >= ENERGY.restUntil - EPS) {
      w.resting = null;
      w.ordered = false;
      emit(s, 'funcionario_volta', w.id);
    }
    return;
  }
  if (!s.config.staffFatigue) return; // sem cansaço (RN-55a): a energia não cai e ninguém precisa descansar
  if (w.position) {
    const mult = w.traits.includes('resistente') ? RESISTANT_FATIGUE : 1;
    w.energy = Math.max(0, w.energy - ENERGY.drainPerSecond * mult * fatigueRate(s) * dt);
  } else {
    w.idleSeconds += dt;
    w.energy = Math.min(100, w.energy + ENERGY.restPlaceRate * dt); // ocioso recupera a 1 por segundo
  }
  w.minEnergy = Math.min(w.minEnergy, w.energy);
  const tired = w.mode === 'auto' ? w.energy < ENERGY.restBelow : w.energy <= 0;
  if (tired) startRest(s, w);
}

/** Cansaço do dia (verão e calor forte entram na US-118). */
export const fatigueRate = (s: DayState): number => fatigueFactor(s);

/** Velocidade geral da equipe: o escritório e o Gerente entram na US-117. */
export function crewSpeed(s: DayState): number {
  let f = 1;
  if (s.pasteleiro.to === null && s.pasteleiro.at === 'escritorio' && s.config.stations.includes('escritorio')) f *= MANAGEMENT_SPEED; // RN-101
  if (s.config.roles.includes('gerente')) f *= MANAGER_SPEED;
  if (s.config.claimRefused) f *= FORECAST.claimRefusedSpeed; // equipe recusada na reivindicação (RN-151)
  return f;
}

// ------------------------------------------------------------ atribuição de posições

function assign(s: DayState): void {
  const pst = pasteleiroStation(s);
  for (const w of s.workers) {
    if (w.position && homeStation(w.position) === pst && pst !== null) release(w, s); // o pasteleiro entra na posição (JA-01)
  }
  const reserved = new Set<PositionId>();
  for (const w of s.workers) if (w.mode === 'fixo' && w.fixedPosition) reserved.add(w.fixedPosition);
  for (const w of s.workers) {
    if (w.position || w.resting || w.away > 0) continue;
    if (w.mode === 'fixo' && w.fixedPosition && vacant(s, w.fixedPosition) && eligible(w, w.fixedPosition)) w.position = w.fixedPosition;
  }
  for (const w of s.workers) {
    if (w.position || w.resting || w.away > 0 || w.mode !== 'auto') continue;
    const pos = AUTO_PRIORITY.find((p) => eligible(w, p) && vacant(s, p) && !reserved.has(p));
    if (pos) w.position = pos;
  }
  // Fritador que perdeu o tacho (o pasteleiro chegou ou pegou fogo) larga a colocação que fazia nele (JA-01)
  const map = fryerTachos(s);
  for (const w of s.workers) {
    if (w.position?.startsWith('fritador') && w.task?.kind === 'colocar' && w.task.tacho !== map.get(w.id)) w.task = null;
  }
}

// ------------------------------------------------------------ tarefas

const claimed = (s: DayState, me: Worker, kind: WorkerTask['kind'], customerId?: number): boolean =>
  s.workers.some((o) => o !== me && o.task?.kind === kind && (customerId === undefined || o.task.customerId === customerId));

function start(w: Worker, s: DayState, task: Omit<WorkerTask, 'total' | 'left'>, base: number, service = false): void {
  let total = base * speedFactor(w) / crewSpeed(s);
  if (service && w.courses.includes('atendimento')) total *= ATTENDANCE_FACTOR;
  w.task = { ...task, total, left: total };
}

/** Melhor item pronto para um cliente: o pastel de maior nota que atende; senão um copo (RN-18). */
function bestFor(s: DayState, c: Customer): ItemRef | null {
  let pastry: { id: number; q: number } | null = null;
  let cup: number | null = null;
  for (const line of c.lines) {
    if (line.delivered !== null) continue;
    for (const r of s.ready) {
      if (r.reservedFor !== undefined || !lineMatches(c, line, r.item)) continue;
      const q = currentQuality(r, now(s));
      if (!pastry || q > pastry.q) pastry = { id: r.id, q };
    }
    for (const x of s.cups) if (cup === null && lineMatches(c, line, x.item)) cup = x.id;
  }
  if (pastry) return { kind: 'pastel', id: pastry.id };
  return cup !== null ? { kind: 'copo', id: cup } : null;
}

function pickBalcao(s: DayState, w: Worker): boolean {
  for (const c of s.customers) {
    if (c.state !== 'anotado' || c.place !== 'fila' || claimed(s, w, 'entregar', c.id)) continue;
    const found = bestFor(s, c);
    if (found) {
      start(w, s, { kind: 'entregar', customerId: c.id, ref: found }, WORK.deliver, true);
      return true;
    }
  }
  if (!cardMachineActive(s) && s.payQueue.length > 0 && !claimed(s, w, 'pagar')) {
    start(w, s, { kind: 'pagar' }, WORK.collect, true);
    return true;
  }
  const next = s.customers.find((c) => c.state === 'aguardando' && c.place === 'fila' && !claimed(s, w, 'anotar', c.id));
  if (next) {
    start(w, s, { kind: 'anotar', customerId: next.id }, WORK.takeOrder, true);
    return true;
  }
  if (!cardMachineActive(s) && s.coins.length > 0 && !claimed(s, w, 'cobrar')) {
    start(w, s, { kind: 'cobrar' }, WORK.collect, true);
    return true;
  }
  return pickDispatch(s, w); // sem outra coisa a fazer, o Balcão também guarda pastéis nas encomendas
}

/** Garçom: anota o grupo na mesa e entrega o pedido pronto (RN-83, RN-86). */
function pickWaiter(s: DayState, w: Worker): boolean {
  for (const c of s.customers) {
    if (c.state !== 'anotado' || c.place !== 'mesa' || claimed(s, w, 'entregar', c.id)) continue;
    const found = bestFor(s, c);
    if (found) {
      start(w, s, { kind: 'entregar', customerId: c.id, ref: found }, WORK.deliver, true);
      return true;
    }
  }
  const next = s.customers.find((c) => c.state === 'aguardando' && c.place === 'mesa' && !claimed(s, w, 'anotar', c.id));
  if (!next) return false;
  start(w, s, { kind: 'anotar', customerId: next.id }, WORK.takeOrder, true);
  return true;
}

/** Expedição: embala pastéis prontos nas comandas do app (RN-40, RN-96). */
function pickDispatch(s: DayState, w: Worker): boolean {
  if (s.workers.some((o) => o !== w && o.task?.kind === 'embalar')) return false;
  const r = s.ready.find((x) => x.reservedFor === undefined && (s.comandas.some((c) => c.items.some((it, k) => c.packed[k] === null && ITEMS[it].base === ITEMS[x.item].base)) || s.bigOrders.some((o) => o.boxed.length < o.qty && ITEMS[o.item].base === ITEMS[x.item].base)));
  if (!r) return false;
  start(w, s, { kind: 'embalar', ref: { kind: 'pastel', id: r.id } }, WORK.deliver, true);
  return true;
}

/** Ajudante: limpa a mesa suja (3 s) e, ocioso, varre a barraca: 10 pontos a cada 3 s (RN-84, RN-132). */
function pickHelper(s: DayState, w: Worker): boolean {
  const factor = w.courses.includes('higiene') ? HYGIENE_CLEAN_FACTOR : 1;
  const table = dirtyTable(s);
  if (table >= 0 && !s.workers.some((o) => o !== w && o.task?.kind === 'limpar' && o.task.tacho === table)) {
    start(w, s, { kind: 'limpar', tacho: table }, WORK.cleanTable * factor);
    return true;
  }
  if (s.dirt > 0) {
    start(w, s, { kind: 'varrer' }, HELPER_CLEAN_SECONDS * factor);
    return true;
  }
  return false;
}

function pickPlace(s: DayState, w: Worker, tachoIndex: number): boolean {
  const tacho = s.tachos[tachoIndex];
  if (!tacho || s.workers.some((o) => o !== w && o.task?.kind === 'colocar' && o.task.tacho === tachoIndex)) return false;
  if (nextFreeBasket(s, tacho) < 0) return false;
  start(w, s, { kind: 'colocar', tacho: tachoIndex }, WORK.place);
  return true;
}

/** Montagem: o pastel montado vai para qualquer tacho com cesto livre, do primeiro para o último (RN-40). */
const pickPlaceAny = (s: DayState, w: Worker): boolean => s.tachos.some((_, i) => pickPlace(s, w, i));

/** Monta o próximo pastel que falta (só a Montagem monta: o Fritador frita pastéis já montados, RN-44). */
function pickAssemble(s: DayState, w: Worker): boolean {
  if (s.assembled.length >= BENCH_CAPACITY) return false;
  const inProgress = s.workers.filter((o) => o.task?.kind === 'montar').map((o) => o.task!.item as ItemId);
  const want = unmetItems(s, false, inProgress).find((id) => canMake(s, ITEMS[id]));
  if (!want) return false;
  const item = ITEMS[want];
  start(w, s, { kind: 'montar', item: want }, WORK.assembleBase + WORK.assemblePerStep * item.steps);
  return true;
}

function pickCaldo(s: DayState, w: Worker): boolean {
  if (autoMillActive(s)) return false; // moenda automática: o funcionário não soma (RN-161)
  const inProgress = s.workers.filter((o) => o.task?.kind === 'caldo').map((o) => o.task!.item as ItemId);
  const want = unmetItems(s, true, inProgress).find((id) => canMake(s, ITEMS[id]));
  if (!want) return false;
  start(w, s, { kind: 'caldo', item: want }, millSeconds(s) + WORK.drinkExtra);
  return true;
}

/**
 * Tacho que precisa de troca: óleo sujo, parado por ninguém, sem o pasteleiro lá (RN-45, RN-46). `only`: o
 * Fritador cuida só do tacho dele; a Troca de óleo atende todos.
 */
function pickOil(s: DayState, w: Worker, only?: number): boolean {
  const pst = pasteleiroStation(s);
  let best = -1;
  s.tachos.forEach((t, i) => {
    if ((only !== undefined && i !== only) || t.dirt < OIL_DIRTY_THRESHOLD - EPS || isChanging(t) || pst === `tacho${i + 1}`) return;
    if (best < 0 || t.dirt > s.tachos[best].dirt) best = i;
  });
  if (best < 0) return false;
  if (canSurprise(s) && !w.courses.includes('fritura') && (s.config.forceEvent === 'fogo' || s.rng.events.chance(SURPRISE.fireChancePerOilChange))) {
    ignite(s, s.tachos[best]); // troca de óleo sem curso de Fritura pode dar fogo (RN-152)
    return true;
  }
  const base = WORK.oilChange * (w.courses.includes('fritura') ? OIL_COURSE_FACTOR : 1);
  const seconds = (base * speedFactor(w)) / crewSpeed(s);
  startWorkerOilChange(s.tachos[best], w.id, seconds);
  w.task = { kind: 'trocar', tacho: best, total: seconds, left: seconds };
  return true;
}

/** O Fritador tira do óleo no meio da janela do ponto: nunca queima (RN-43). Devolve true se tirou algo. */
function fryerTakes(s: DayState, w: Worker, tachoIndex: number): boolean {
  const tacho = s.tachos[tachoIndex];
  if (!tacho || timerActive(s, tacho)) return false; // com o timer ativo a posição vira opcional: só as outras tarefas (RN-161)
  for (let i = 0; i < tacho.baskets.length; i++) {
    const f = tacho.baskets[i].frying;
    if (!f) continue;
    const win = fryWindow(ITEMS[f.item], tacho);
    const mid = win.ponto[0] + (win.ponto[1] - win.ponto[0]) / 2;
    if (!f.burned && f.ticks * STEP < mid - EPS) continue;
    const before = s.ready.length;
    if (!takeBasket(s, tacho, i, fryBonus(w))) continue;
    maybeBurnWorker(s, w);
    if (s.ready.length > before && warmerCapacity(s) > warmedCount(s)) warmReady(s, s.ready[s.ready.length - 1].id);
    return true;
  }
  return false;
}

function pickTask(s: DayState, w: Worker): void {
  const pos = w.position;
  if (!pos) return;
  if (pos === 'balcao') pickBalcao(s, w);
  else if (pos === 'trocador') pickOil(s, w);
  else if (pos === 'moenda') pickCaldo(s, w);
  else if (pos === 'garcom') pickWaiter(s, w);
  else if (pos === 'ajudante') pickHelper(s, w);
  else if (pos === 'expedicao') pickDispatch(s, w);
  else if (pos.startsWith('montagem')) {
    if (!pickPlaceAny(s, w)) pickAssemble(s, w);
  } else if (pos.startsWith('fritador')) {
    const n = fryerTachos(s).get(w.id);
    if (n === undefined) return; // nenhum tacho livre para ele
    // o Fritador cuida de tudo no tacho dele: tira no ponto, troca o óleo e coloca os pastéis já montados (RN-44)
    if (fryerTakes(s, w, n) || pickOil(s, w, n)) return;
    pickPlace(s, w, n);
  }
}

/** Sabor que o funcionário realmente monta: o Distraído erra 5% das vezes (RN-114). */
export function flavorFor(s: DayState, w: Worker, wanted: ItemId): ItemId {
  if (!w.traits.includes('distraido') || !s.rng.staff.chance(WRONG_FLAVOR_CHANCE)) return wanted;
  const options = s.config.menu.map((m) => m.item).filter((id) => id !== wanted && ITEMS[id].kind === ITEMS[wanted].kind && canMake(s, ITEMS[id]));
  return options.length ? options[s.rng.staff.int(0, options.length - 1)] : wanted;
}

function complete(s: DayState, w: Worker, t: WorkerTask): void {
  switch (t.kind) {
    case 'anotar': {
      const c = s.customers.find((x) => x.id === t.customerId);
      if (c && c.state === 'aguardando') noteOrder(s, c, w);
      break;
    }
    case 'cobrar':
      takeCoins(s);
      break;
    case 'pagar':
      chargeGroup(s);
      break;
    case 'limpar':
      if (t.tacho !== undefined) cleanTable(s, t.tacho);
      break;
    case 'embalar':
      if (t.ref && !packPastry(s, t.ref.id)) boxPastry(s, t.ref.id);
      break;
    case 'varrer':
      addDirt(s, -HELPER_CLEAN_POINTS);
      break;
    case 'entregar':
      if (t.customerId !== undefined && t.ref) deliverItem(s, t.ref, t.customerId, w);
      break;
    case 'montar': {
      assembleItem(s, flavorFor(s, w, t.item!), w.traits.includes('caprichoso') ? CARE_BONUS : 0);
      break;
    }
    case 'colocar': {
      const tacho = s.tachos[t.tacho ?? 0];
      const i = tacho ? nextFreeBasket(s, tacho) : -1;
      if (tacho && i >= 0) placeBasket(s, tacho, i);
      break;
    }
    case 'caldo':
      makeCup(s, t.item!);
      break;
    case 'trocar':
      break;
  }
}

function runTask(s: DayState, w: Worker, dt: number): void {
  const t = w.task;
  if (!t) return;
  if (t.kind === 'trocar') {
    const tacho = s.tachos[t.tacho ?? 0];
    if (!tacho || tacho.changeBy !== w.id) w.task = null; // o tacho terminou (ou foi cancelado)
    return;
  }
  t.left -= dt;
  if (t.left <= EPS) {
    w.task = null;
    complete(s, w, t);
  }
}

/** Posições, energia, descanso e tarefas da equipe a cada passo (RN-40, RN-43–45, RN-115–116). */
export function updateStaff(s: DayState, dt: number): void {
  if (s.workers.length === 0) return;
  for (const w of s.workers) updateEnergy(s, w, dt);
  assign(s);
  for (const w of s.workers) {
    if (!w.position || w.resting || w.away > 0) continue;
    if (!w.task) pickTask(s, w);
    runTask(s, w, dt);
  }
}
