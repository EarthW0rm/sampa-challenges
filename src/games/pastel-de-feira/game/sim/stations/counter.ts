import { FAIL_WEIGHT, NO_BAG_PENALTY, PROFILE_MIN_QUALITY } from '../../constants';
import { ITEMS, type ItemId } from '../../data/recipes';
import type { ItemRef } from '../../types';
import { failOrder, menuEntry, removeCustomer } from '../customers';
import { isAt } from '../pasteleiro';
import { currentQuality, drinkValue, pastryValue, roundCents } from '../quality';
import { recordSuccess } from '../reputation';
import { emit, newId, now, type Customer, type DayState, type OrderLine } from '../state';

/** Anotar o cliente da frente (RN-42): o primeiro da fila ainda não anotado. */
export function takeOrder(s: DayState): boolean {
  if (!isAt(s, 'balcao')) return false;
  const c = s.customers.find((x) => x.state === 'aguardando');
  if (!c) return false;
  c.state = 'anotado';
  emit(s, 'anotou', c.id);
  return true;
}

/** Cobrar: recolhe as moedas do balcão (RN-42). Cada moeda sai uma vez só. */
export function collectCoins(s: DayState): boolean {
  if (!isAt(s, 'balcao') || s.coins.length === 0) return false;
  let total = 0;
  for (const coin of s.coins) total += coin.amount;
  s.coins.length = 0;
  s.stats.revenue = roundCents(s.stats.revenue + total);
  emit(s, 'cobrou');
  return true;
}

/** O item entregue atende à linha do pedido? Só o Exigente exige a versão exata (RN-18). */
function matches(c: Customer, line: OrderLine, delivered: ItemId): boolean {
  if (line.delivered !== null) return false;
  const want = ITEMS[line.item];
  const got = ITEMS[delivered];
  if ((want.kind === 'bebida') !== (got.kind === 'bebida')) return false;
  return c.profile === 'exigente' ? line.item === delivered : want.base === got.base;
}

/** Entregar um item pronto a um cliente anotado (RN-42, RN-63). Devolve false só se o comando não pôde valer. */
export function deliver(s: DayState, ref: ItemRef, customerId: number): boolean {
  if (!isAt(s, 'balcao')) return false;
  const c = s.customers.find((x) => x.id === customerId);
  if (!c || c.state !== 'anotado') return false;
  const pastry = ref.kind === 'pastel' ? s.ready.find((r) => r.id === ref.id) : undefined;
  const cup = ref.kind === 'copo' ? s.cups.find((x) => x.id === ref.id) : undefined;
  const itemId = pastry?.item ?? cup?.item;
  if (!itemId) return false;

  const pending = c.lines.filter((l) => matches(c, l, itemId));
  const line = pending.find((l) => l.item === itemId) ?? pending[0];
  if (!line) {
    // Item errado: o cliente recusa, o item volta e o pedido vira falha, uma vez só (RN-63).
    if (!c.wrong) {
      c.wrong = true;
      s.stats.wrong++;
    }
    failOrder(s, c, FAIL_WEIGHT.counter);
    emit(s, 'item_errado', c.id);
    return true;
  }

  const price = menuEntry(s, itemId)?.price ?? ITEMS[itemId].reference;
  let value: number;
  if (pastry) {
    let nota = currentQuality(pastry, now(s));
    if (s.consumables.saquinho > 0) s.consumables.saquinho--;
    else nota = Math.max(0, nota - NO_BAG_PENALTY); // sem saquinho (RN-28)
    if (nota < PROFILE_MIN_QUALITY[c.profile]) c.lowQuality = true; // paga, mas falha (RN-15)
    value = pastryValue(price, nota, s.config.reputation);
    s.ready.splice(s.ready.indexOf(pastry), 1);
  } else {
    value = drinkValue(price, s.config.reputation);
    s.cups.splice(s.cups.indexOf(cup!), 1);
  }
  c.owed += value;
  line.delivered = itemId;
  emit(s, 'entregou', c.id);

  if (c.lines.every((l) => l.delivered !== null)) {
    if (c.lowQuality) failOrder(s, c, FAIL_WEIGHT.counter);
    else if (!c.failed) recordSuccess(s);
    s.stats.served++;
    s.coins.push({ id: newId(s), amount: roundCents(c.owed) });
    removeCustomer(s, c);
  }
  return true;
}
