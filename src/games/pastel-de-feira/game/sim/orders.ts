import type { DayState, OrderLine } from './state';
import { createTicket } from './tickets';

/**
 * Encomendas aceitas para o dia: cada uma vira a comanda E no trilho da Expedição às 07h, com a caixa no
 * balcão da Expedição e as unidades na lista de produção (RN-104, RN-187). O cliente chega no horário e
 * entra na fila da Expedição (`dispatch.ts`).
 */
export function startOrders(s: DayState): void {
  for (const o of s.config.orders) {
    const slots: OrderLine[] = Array.from({ length: o.qty }, () => ({ item: o.item, filled: null }));
    const t = createTicket(s, 'encomenda', null, slots, 0);
    t.pickupAt = o.pickupAt;
    t.pay = o.pay;
    t.fine = o.fine;
  }
}
