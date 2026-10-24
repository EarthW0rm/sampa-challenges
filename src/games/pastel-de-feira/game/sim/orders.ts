import { FAIL_WEIGHT } from '../constants';
import { ORDERS } from '../data/office';
import { ITEMS } from '../data/recipes';
import { currentQuality, roundCents } from './quality';
import { recordFailure, recordSuccess } from './reputation';
import { emit, now, type BigOrder, type DayState } from './state';

/** Alguém no Balcão ou na Expedição entrega a encomenda (RN-104). */
function attendantPresent(s: DayState): boolean {
  const p = s.pasteleiro;
  if (p.to === null && (p.at === 'balcao' || p.at === 'expedicao')) return true;
  return s.workers.some((w) => w.position === 'balcao' || w.position === 'expedicao');
}

export const isFull = (o: BigOrder): boolean => o.boxed.length >= o.qty;

/** Guarda um pastel pronto na caixa da primeira encomenda que o pede (RN-104). A caixa não usa a estufa. */
export function boxPastry(s: DayState, readyId: number): boolean {
  const r = s.ready.find((x) => x.id === readyId);
  if (!r || r.reservedFor !== undefined) return false;
  const o = s.bigOrders.find((x) => !isFull(x) && ITEMS[x.item].base === ITEMS[r.item].base);
  if (!o) return false;
  r.quality = currentQuality(r, now(s));
  r.readyAt = now(s);
  r.boxed = true;
  r.warmed = false;
  r.reservedFor = o.id;
  o.boxed.push(r.id);
  return true;
}

function dropBox(s: DayState, o: BigOrder): void {
  for (const id of o.boxed) {
    const i = s.ready.findIndex((x) => x.id === id);
    if (i >= 0) s.ready.splice(i, 1);
  }
  o.boxed.length = 0;
}

/** O cliente da encomenda chega no horário e espera 30 s; completa paga, incompleta paga multa (RN-104). */
export function updateOrders(s: DayState, dt: number): void {
  for (let i = s.bigOrders.length - 1; i >= 0; i--) {
    const o = s.bigOrders[i];
    if (o.state === 'pendente') {
      if (now(s) < o.pickupAt) continue;
      o.state = 'espera';
      o.waitLeft = ORDERS.waitSeconds;
      emit(s, 'encomenda_chegou', o.id);
    }
    if (isFull(o) && attendantPresent(s)) {
      const pay = roundCents(o.pay);
      s.stats.revenue = roundCents(s.stats.revenue + pay);
      s.stats.orderRevenue = roundCents(s.stats.orderRevenue + pay);
      s.stats.encDone++;
      s.stats.served++;
      recordSuccess(s);
      dropBox(s, o);
      s.bigOrders.splice(i, 1);
      emit(s, 'encomenda_entregue', o.id);
      continue;
    }
    o.waitLeft -= dt;
    if (o.waitLeft <= 0) {
      s.stats.fines = roundCents(s.stats.fines + o.fine);
      s.stats.encFailed++;
      recordFailure(s, FAIL_WEIGHT.orderLate);
      dropBox(s, o);
      s.bigOrders.splice(i, 1);
      emit(s, 'encomenda_falhou', o.id);
    }
  }
}
