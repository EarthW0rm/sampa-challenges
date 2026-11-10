import {
  APP_FEE, APP_LOW_QUALITY, APP_MOTO_WAIT, APP_MOTO_WAIT_LOW_REP, APP_TRANSPORT_LOSS, CHARM_GIFT, DISPATCH_HANDOFF, FAIL_WEIGHT, LOW_REPUTATION_LIMIT,
} from '../constants';
import { ORDERS } from '../data/office';
import { ATTENDANCE_FACTOR } from '../data/staff';
import { ITEMS } from '../data/recipes';
import { itemCost, menuEntry } from './customers';
import { currentQuality, qualityFactor, reputationPremium, roundCents } from './quality';
import { addCharm, recordFailure, recordSuccess } from './reputation';
import { emit, newId, now, type DayState, type DispatchEntry, type Ticket } from './state';
import { dropTicket, isPastry } from './tickets';

/** Atendente da Expedição: o pasteleiro no balcão da Expedição ou o funcionário da posição (RN-183, RN-190). */
export function dispatchAttendant(s: DayState): { present: boolean; factor: number } {
  const p = s.pasteleiro;
  if (p.to === null && p.at === 'expedicao') return { present: true, factor: 1 };
  const w = s.workers.find((x) => x.position === 'expedicao' && !x.resting && x.away <= 0);
  if (!w) return { present: false, factor: 1 };
  return { present: true, factor: w.courses.includes('atendimento') ? ATTENDANCE_FACTOR : 1 }; // Atendimento −20% (RN-118)
}

const complete = (t: Ticket): boolean => t.slots.every((l) => l.filled !== null);

/** O dono chega no horário e entra na fila da Expedição, com a sua paciência (RN-191–193). */
function arrivals(s: DayState): void {
  for (const t of s.tickets) {
    if (t.track !== 'expedicao' || t.owner !== null || t.pickupAt === undefined || t.pickupAt > now(s)) continue;
    const who = t.kind === 'app' ? 'motoboy' : 'encomenda';
    const patience = who === 'motoboy' ? APP_MOTO_WAIT * (s.config.reputation < LOW_REPUTATION_LIMIT ? APP_MOTO_WAIT_LOW_REP : 1) : ORDERS.waitSeconds;
    const e: DispatchEntry = { id: newId(s), ticketId: t.id, who, patience, patienceMax: patience, handoffLeft: null };
    t.owner = e.id;
    s.dispatchQueue.push(e);
    emit(s, who === 'motoboy' ? 'moto_chegou' : 'encomenda_chegou', t.id);
  }
}

/** Retirada do app: preço − 20% de taxa, com a nota da retirada menos o transporte (RN-93, RN-25). */
function pickupApp(s: DayState, t: Ticket): void {
  let low = false;
  let revenue = 0;
  const loss = s.config.equipment.thermalBag ? 0 : APP_TRANSPORT_LOSS;
  for (const slot of t.slots) {
    const x = slot.filled;
    if (!x || !isPastry(x)) continue;
    const nota = Math.max(0, currentQuality(x, now(s)) - loss);
    if (nota < APP_LOW_QUALITY) low = true;
    if (slot.gift) {
      addCharm(s, CHARM_GIFT); // brinde no app: encanto e custo, sem pagamento (RN-122)
      s.stats.giftCost += itemCost(slot.item);
      s.stats.gifts++;
      continue;
    }
    const price = menuEntry(s, slot.item)?.price ?? ITEMS[slot.item].reference;
    revenue += price * (1 - APP_FEE) * qualityFactor(nota) * reputationPremium(s.config.reputation);
  }
  revenue = roundCents(revenue);
  s.stats.revenue = roundCents(s.stats.revenue + revenue);
  s.stats.appRevenue = roundCents(s.stats.appRevenue + revenue);
  s.stats.appPicked++;
  s.stats.served++;
  if (low) recordFailure(s, FAIL_WEIGHT.appLowQuality);
  else recordSuccess(s);
  emit(s, 'comanda_entregue', t.id);
}

/** Retirada da encomenda completa: paga o combinado (RN-102, RN-104). */
function pickupOrder(s: DayState, t: Ticket): void {
  const pay = roundCents(t.pay ?? 0);
  s.stats.revenue = roundCents(s.stats.revenue + pay);
  s.stats.orderRevenue = roundCents(s.stats.orderRevenue + pay);
  s.stats.encDone++;
  s.stats.served++;
  recordSuccess(s);
  emit(s, 'encomenda_entregue', t.id);
}

/** O dono vai embora sem a comanda: itens perdidos e falha de peso 3,0; a encomenda paga multa (RN-94, RN-104). */
function cancelDispatch(s: DayState, t: Ticket, e: DispatchEntry): void {
  if (e.who === 'motoboy') {
    s.stats.appCancelled++;
    recordFailure(s, FAIL_WEIGHT.appLate);
    emit(s, 'comanda_cancelada', t.id);
  } else {
    s.stats.fines = roundCents(s.stats.fines + (t.fine ?? 0));
    s.stats.encFailed++;
    recordFailure(s, FAIL_WEIGHT.orderLate);
    emit(s, 'encomenda_falhou', t.id);
  }
  dropTicket(s, t);
  emit(s, 'ticket_cancelada', t.id);
}

/**
 * Fila da Expedição (RN-191, RN-192): quem chegou espera com a paciência correndo; o da frente recebe a sacola
 * ou a caixa completa quando há atendente (entrega de 1,5 s). Sem atendente, a fila cresce.
 */
export function updateDispatch(s: DayState, dt: number): void {
  arrivals(s);
  const q = s.dispatchQueue;
  const front = q[0];
  if (front) {
    const t = s.tickets.find((x) => x.id === front.ticketId);
    const att = dispatchAttendant(s);
    if (t && complete(t) && att.present) {
      front.handoffLeft ??= DISPATCH_HANDOFF * att.factor;
      front.handoffLeft -= dt;
      if (front.handoffLeft <= 1e-9) {
        if (front.who === 'motoboy') pickupApp(s, t);
        else pickupOrder(s, t);
        dropTicket(s, t);
        emit(s, 'ticket_entregue', t.id);
        q.shift();
      }
    }
  }
  for (let i = q.length - 1; i >= 0; i--) {
    const e = q[i];
    if (e.handoffLeft !== null) continue; // sendo atendido: não desiste no meio da entrega
    e.patience -= dt;
    if (e.patience > 0) continue;
    const t = s.tickets.find((x) => x.id === e.ticketId);
    if (t) cancelDispatch(s, t, e);
    q.splice(i, 1);
  }
}
