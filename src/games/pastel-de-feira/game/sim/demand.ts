import { ITEMS, type ItemId } from '../data/recipes';
import type { Customer, DayState } from './state';

/** Linhas de pedido ainda sem entrega de clientes já anotados, na ordem da fila. */
export function pendingLines(s: DayState, drinks: boolean): { c: Customer; item: ItemId }[] {
  const out: { c: Customer; item: ItemId }[] = [];
  for (const c of s.customers) {
    if (c.state !== 'anotado') continue;
    for (const line of c.lines) if (line.delivered === null && (ITEMS[line.item].kind === 'bebida') === drinks) out.push({ c, item: line.item });
  }
  return out;
}

/** Quanto já existe (pronto, em produção ou em andamento) de cada item. */
function supplyMap(s: DayState, drinks: boolean, inProgress: readonly ItemId[]): Map<ItemId, number> {
  const m = new Map<ItemId, number>();
  const add = (id: ItemId) => m.set(id, (m.get(id) ?? 0) + 1);
  if (drinks) {
    for (const cup of s.cups) add(cup.item);
  } else {
    for (const a of s.assembled) add(a.item);
    for (const t of s.tachos) for (const b of t.baskets) if (b.frying && !b.frying.burned) add(b.frying.item);
    for (const r of s.ready) add(r.item);
  }
  for (const id of inProgress) if ((ITEMS[id].kind === 'bebida') === drinks) add(id);
  return m;
}

/**
 * Itens que ainda faltam produzir para cobrir os pedidos anotados, na ordem da fila. Quem não é
 * Exigente aceita qualquer versão da mesma receita (RN-18).
 */
export function unmetItems(s: DayState, drinks: boolean, inProgress: readonly ItemId[] = []): ItemId[] {
  const supply = supplyMap(s, drinks, inProgress);
  const out: ItemId[] = [];
  for (const { c, item } of pendingLines(s, drinks)) {
    if ((supply.get(item) ?? 0) > 0) {
      supply.set(item, supply.get(item)! - 1);
      continue;
    }
    if (c.profile !== 'exigente') {
      const alt = [...supply.entries()].find(([id, n]) => n > 0 && ITEMS[id].base === ITEMS[item].base);
      if (alt) {
        supply.set(alt[0], alt[1] - 1);
        continue;
      }
    }
    out.push(item);
  }
  return out;
}
