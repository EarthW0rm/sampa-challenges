import { PATIENCE_COURSE_BONUS } from '../../data/staff';
import { isAt } from '../pasteleiro';
import { roundCents } from '../quality';
import { collectPayment } from './tables';
import { emit, type Customer, type DayState, type Worker } from '../state';
import { ticketForCustomer } from '../tickets';

/** Anota um cliente (RN-42). Quem anota com o curso de Atendimento deixa o cliente mais paciente (RN-118). */
export function noteOrder(s: DayState, c: Customer, by?: Worker): void {
  c.state = 'anotado';
  ticketForCustomer(s, c); // o pedido vira a comanda #N no trilho do balcão (RN-180)
  if (by?.courses.includes('atendimento')) {
    c.patience += c.patienceMax * PATIENCE_COURSE_BONUS;
    c.patienceMax *= 1 + PATIENCE_COURSE_BONUS;
  }
  emit(s, 'anotou', c.id);
}

/** Anotar o cliente da frente: o primeiro da fila ainda não anotado (pasteleiro, no balcão). */
export function takeOrder(s: DayState): boolean {
  if (!isAt(s, 'balcao')) return false;
  const c = s.customers.find((x) => x.state === 'aguardando' && x.place === 'fila');
  if (!c) return false;
  noteOrder(s, c);
  return true;
}

/** Anotar o pedido de um grupo na mesa (pasteleiro nas mesas, RN-83). */
export function takeTableOrder(s: DayState): boolean {
  if (!isAt(s, 'mesas')) return false;
  const c = s.customers.find((x) => x.state === 'aguardando' && x.place === 'mesa');
  if (!c) return false;
  noteOrder(s, c);
  return true;
}

/** Recolhe as moedas do balcão (RN-42). Cada moeda sai uma vez só. */
export function takeCoins(s: DayState): boolean {
  if (s.coins.length === 0) return false;
  let total = 0;
  for (const coin of s.coins) total += coin.amount;
  s.coins.length = 0;
  s.stats.revenue = roundCents(s.stats.revenue + total);
  emit(s, 'cobrou');
  return true;
}

export const collectCoins = (s: DayState): boolean => isAt(s, 'balcao') && takeCoins(s);

/** Cobrar o primeiro grupo da fila de pagamento (pasteleiro no balcão, RN-87). */
export const chargeNextGroup = (s: DayState): boolean => collectPayment(s);
