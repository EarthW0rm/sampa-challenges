import {
  DIRT_PER_TABLE_CUSTOMER, EAT_SECONDS, FAIL_WEIGHT, GROUP_WEIGHTS, PAY_PATIENCE, PAY_QUEUE_MAX, TABLE_SEATS,
} from '../../constants';
import type { Rng } from '../../rng';
import { addDirt } from '../dirt';
import { isAt } from '../pasteleiro';
import { roundCents } from '../quality';
import { recordFailure } from '../reputation';
import { emit, type Customer, type DayState, type SeatState } from '../state';

/** Tamanho do grupo de mesa: 1 a 4 com 40% / 30% / 20% / 10% (RN-85). */
export function drawGroupSize(rng: Rng): number {
  return (rng.weighted([0, 1, 2, 3], (i) => GROUP_WEIGHTS[i]) ?? 0) + 1;
}

const countSeats = (seats: readonly SeatState[], st: SeatState): number => seats.filter((x) => x === st).length;

/** Mesa de melhor encaixe com lugares livres e limpos para todos do grupo (RN-85). -1 se não há. */
export function findTable(s: DayState, size: number): number {
  let best = -1;
  s.tables.forEach((t, i) => {
    const free = countSeats(t.seats, 'livre');
    if (free >= size && (best < 0 || free < countSeats(s.tables[best].seats, 'livre'))) best = i;
  });
  return best;
}

/** Ocupa `size` lugares livres da mesa. Devolve os índices. */
export function occupySeats(s: DayState, table: number, size: number): number[] {
  const seats = s.tables[table].seats;
  const out: number[] = [];
  for (let i = 0; i < TABLE_SEATS && out.length < size; i++) {
    if (seats[i] === 'livre') {
      seats[i] = 'ocupado';
      out.push(i);
    }
  }
  return out;
}

/** Libera os lugares do grupo: limpos se ele desistiu antes de comer, sujos se comeu (RN-84). */
export function releaseSeats(s: DayState, c: Customer, to: SeatState): void {
  if (!c.group) return;
  const t = s.tables[c.group.table];
  if (t) for (const i of c.group.seats) t.seats[i] = to;
}

/** Há garçom atendendo: um funcionário na posição ou o pasteleiro nas mesas (RN-83). */
export function waiterPresent(s: DayState): boolean {
  return s.workers.some((w) => w.position === 'garcom') || isAt(s, 'mesas');
}

/** O grupo que já comeu sai da mesa e vai para a fila de pagamento (RN-87). */
function leaveTable(s: DayState, c: Customer): boolean {
  if (s.payQueue.length >= PAY_QUEUE_MAX) return false; // fila cheia: espera na mesa, que continua ocupada
  releaseSeats(s, c, 'sujo');
  addDirt(s, DIRT_PER_TABLE_CUSTOMER * (c.group?.size ?? 1));
  c.place = 'pagamento';
  c.timer = PAY_PATIENCE;
  s.payQueue.push(c);
  emit(s, 'grupo_foi_embora', c.id);
  return true;
}

/** Cobra o primeiro grupo da fila de pagamento (no balcão). O prêmio de mesa já está no valor (RN-82, RN-87). */
export function chargeGroup(s: DayState): boolean {
  const c = s.payQueue.shift();
  if (!c) return false;
  const value = roundCents(c.owed);
  s.stats.revenue = roundCents(s.stats.revenue + value);
  s.stats.tableRevenue = roundCents(s.stats.tableRevenue + value);
  emit(s, 'grupo_pagou', c.id);
  return true;
}

export const collectPayment = (s: DayState): boolean => isAt(s, 'balcao') && chargeGroup(s);

/** Tempo comendo e paciência da fila de pagamento (RN-82, RN-87). */
export function updateTables(s: DayState, dt: number): void {
  for (let i = 0; i < s.eating.length; i++) {
    const c = s.eating[i];
    c.timer = Math.max(0, c.timer - dt);
    if (c.timer <= 0 && leaveTable(s, c)) {
      s.eating.splice(i, 1);
      i--;
    }
  }
  for (let i = s.payQueue.length - 1; i >= 0; i--) {
    const c = s.payQueue[i];
    c.timer -= dt;
    if (c.timer <= 0) {
      s.payQueue.splice(i, 1);
      s.stats.payFail++;
      recordFailure(s, FAIL_WEIGHT.payment); // sai sem pagar (RN-87)
      emit(s, 'grupo_foi_embora', c.id);
    }
  }
}

export { EAT_SECONDS };
