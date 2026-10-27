import { emit, newId, now, type Customer, type DayState, type OrderLine, type Ticket, type TicketKind, type Track } from './state';

/** Trilho de cada tipo de comanda: balcão e mesa no balcão, app e encomenda na Expedição (RN-181). */
export const trackOf = (kind: TicketKind): Track => (kind === 'app' || kind === 'encomenda' ? 'expedicao' : 'balcao');

/** Prefixo do número visível (RN-180). */
export const TICKET_PREFIX: Readonly<Record<TicketKind, string>> = { balcao: '#', mesa: 'M', app: 'APP ', encomenda: 'E' };

/** Rótulo da comanda como aparece no trilho e na placa do dono: "#3", "M2", "APP 7", "E1". */
export const ticketLabel = (t: Ticket): string => `${TICKET_PREFIX[t.kind]}${t.num}`;

/** Cria a comanda no momento em que o pedido entra (RN-180). */
export function createTicket(s: DayState, kind: TicketKind, owner: number | null, slots: OrderLine[], enteredAt = now(s)): Ticket {
  const t: Ticket = { id: newId(s), num: s.nextTicketNum++, kind, track: trackOf(kind), owner, enteredAt, slots };
  s.tickets.push(t);
  emit(s, 'ticket_criada', t.id);
  return t;
}

/** Comanda aberta de um cliente ou grupo, se houver. */
export const ticketOf = (s: DayState, customerId: number): Ticket | undefined =>
  s.tickets.find((t) => t.owner === customerId && (t.kind === 'balcao' || t.kind === 'mesa'));

/** Comandas abertas de um trilho, da mais antiga para a mais nova (RN-188). */
export const openTickets = (s: DayState, track: Track): Ticket[] =>
  s.tickets.filter((t) => t.track === track).sort((a, b) => a.enteredAt - b.enteredAt || a.num - b.num);

/** Tira a comanda do trilho (entregue ou cancelada). */
export function dropTicket(s: DayState, t: Ticket): void {
  const i = s.tickets.indexOf(t);
  if (i >= 0) s.tickets.splice(i, 1);
}

/** Cancela a comanda: sai do trilho e os itens já postos nela se perdem (RN-06, RN-94, RN-104). */
export function cancelTicket(s: DayState, t: Ticket): void {
  dropTicket(s, t);
  emit(s, 'ticket_cancelada', t.id);
}

/** Cria a comanda de um cliente ou grupo anotado: os itens são o próprio pedido dele. */
export function ticketForCustomer(s: DayState, c: Customer): Ticket {
  return createTicket(s, c.group ? 'mesa' : 'balcao', c.id, c.lines);
}
