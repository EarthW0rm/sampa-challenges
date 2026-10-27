import { APP_PICKUP_DELAY } from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import type { DayState } from './state';

/** Item que ainda falta produzir: o sabor pedido e se só a versão exata serve (Exigente, RN-18). */
export interface Want {
  item: ItemId;
  exact: boolean;
  /** Entrada do pedido (RN-180): ordena a lista. */
  at: number;
}

/**
 * Lista de produção (RN-187): os itens livres de todas as comandas abertas, na ordem de entrada dos pedidos
 * e, dentro da comanda, na ordem dos itens. Sem prioridade fixa para app ou encomenda (CE-21).
 */
export function productionList(s: DayState): Want[] {
  const out: Want[] = [];
  for (const t of s.tickets) {
    const owner = t.owner === null ? undefined : s.customers.find((c) => c.id === t.owner);
    for (const slot of t.slots) {
      if (slot.filled !== null) continue;
      out.push({ item: slot.item, exact: (slot.profile ?? owner?.profile) === 'exigente', at: t.enteredAt });
    }
  }
  // comandas do app e encomendas ainda no modelo anterior (até a US-136): entram pela hora em que foram aceitas
  for (const c of s.comandas) {
    c.items.forEach((item, k) => {
      if (c.packed[k] === null) out.push({ item, exact: false, at: c.pickupAt - APP_PICKUP_DELAY });
    });
  }
  for (const o of s.bigOrders) for (let k = o.boxed.length; k < o.qty; k++) out.push({ item: o.item, exact: false, at: 0 });
  // ordem estável: entrada do pedido; empate mantém a ordem de criação
  return out.map((w, i) => ({ w, i })).sort((a, b) => a.w.at - b.w.at || a.i - b.i).map((x) => x.w);
}

/** Quanto já existe (pronto sem comanda, montado, no óleo ou em andamento) de cada item. */
function supplyMap(s: DayState, drinks: boolean, inProgress: readonly ItemId[]): Map<ItemId, number> {
  const m = new Map<ItemId, number>();
  const add = (id: ItemId) => m.set(id, (m.get(id) ?? 0) + 1);
  if (drinks) {
    for (const cup of s.cups) add(cup.item);
  } else {
    for (const a of s.assembled) add(a.item);
    for (const t of s.tachos) for (const b of t.baskets) if (b.frying && !b.frying.burned) add(b.frying.item);
    for (const r of s.ready) if (r.reservedFor === undefined) add(r.item);
  }
  for (const id of inProgress) if ((ITEMS[id].kind === 'bebida') === drinks) add(id);
  return m;
}

/**
 * Itens que ainda faltam produzir, na ordem da lista de produção (RN-187), descontando o que já existe.
 * Quem não é Exigente aceita qualquer versão da mesma receita (RN-18).
 */
export function unmet(s: DayState, drinks: boolean, inProgress: readonly ItemId[] = []): ItemId[] {
  const supply = supplyMap(s, drinks, inProgress);
  const out: ItemId[] = [];
  for (const want of productionList(s)) {
    if ((ITEMS[want.item].kind === 'bebida') !== drinks) continue;
    if ((supply.get(want.item) ?? 0) > 0) {
      supply.set(want.item, supply.get(want.item)! - 1);
      continue;
    }
    if (!want.exact) {
      const alt = [...supply.entries()].find(([id, n]) => n > 0 && ITEMS[id].base === ITEMS[want.item].base);
      if (alt) {
        supply.set(alt[0], alt[1] - 1);
        continue;
      }
    }
    out.push(want.item);
  }
  return out;
}
