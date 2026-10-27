import { DAY_TICKS, STEP } from '../../game/constants';
import { addCustomer } from '../../game/sim/customers';
import { noteOrder } from '../../game/sim/stations/counter';
import { ticketLabel, ticketOf } from '../../game/sim/tickets';
import { devConfig } from '../testConfig';
import { advance, check, checkEq, makeSim, type Scenario } from '../harness';

/** Sem chegadas aleatórias: o cenário controla os clientes. */
const quiet = (seed: number, config = devConfig()) => {
  const sim = makeSim(seed, config);
  sim.state.arrivalLeft = 1e9;
  return sim;
};

export const comandas: Scenario[] = [
  {
    id: 'rn180-anotar-cria-comanda-numerada',
    rules: 'RN-180, RN-181',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const a = addCustomer(s, 'padrao', ['queijo', 'carne', 'caldo-puro']);
      const b = addCustomer(s, 'economico', ['carne']);
      checkEq(s.tickets.length, 0, 'antes de anotar não há comanda');
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'anotar' } });
      sim.step();
      const ta = ticketOf(s, a.id);
      check(ta, 'anotar cria a comanda do primeiro da fila');
      checkEq(ta.num, 1, 'primeira comanda do dia é a #1');
      checkEq(ticketLabel(ta), '#1', 'balcão usa o prefixo #');
      checkEq(ta.track, 'balcao', 'comanda de balcão fica no trilho do balcão');
      checkEq(ta.slots.length, 3, 'um item por unidade pedida');
      check(ta.slots === a.lines, 'os itens da comanda são o próprio pedido do cliente');
      noteOrder(s, b);
      const tb = ticketOf(s, b.id);
      checkEq(tb?.num, 2, 'a próxima comanda é a #2');
      check(s.events.some((e) => e.type === 'ticket_criada'), 'evento ticket_criada');
    },
  },
  {
    id: 'rn180-brinde-entra-como-item',
    rules: 'RN-180, RN-120',
    run(seed) {
      const sim = quiet(seed, devConfig({ promo: { brindeN: 2, chorinho: 0, xepa: false, xepaDiscount: 0.3 } }));
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['queijo', 'carne']);
      c.lines.push({ item: 'queijo', gift: true, delivered: null });
      noteOrder(s, c);
      const t = ticketOf(s, c.id)!;
      checkEq(t.slots.length, 3, 'brinde ocupa um item da comanda');
      checkEq(t.slots.filter((l) => l.gift).length, 1, 'o item de brinde fica marcado');
    },
  },
  {
    id: 'rn180-paciencia-esgotada-cancela-comanda',
    rules: 'RN-180, RN-06',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'exigente', ['queijo']);
      noteOrder(s, c);
      check(ticketOf(s, c.id), 'comanda aberta');
      c.patience = 0.5;
      advance(sim, Math.round(1 / STEP));
      checkEq(s.tickets.length, 0, 'cliente que desiste leva a comanda embora');
      check(s.events.some((e) => e.type === 'ticket_cancelada'), 'evento ticket_cancelada');
    },
  },
  {
    id: 'rn07-comandas-abertas-somem-as-14h',
    rules: 'RN-07, RN-180',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'economico', ['carne']);
      noteOrder(s, c);
      c.patience = c.patienceMax = 1e9;
      const failures = s.rep.failures;
      advance(sim, DAY_TICKS + 5);
      check(sim.isOver(), 'o dia terminou');
      checkEq(s.tickets.length, 0, 'nenhuma comanda aberta depois das 14h');
      checkEq(s.rep.failures, failures, 'sem falha no corte seco');
    },
  },
];
