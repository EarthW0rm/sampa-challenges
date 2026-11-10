import { DAY_TICKS, STEP } from '../../game/constants';
import { addCustomer } from '../../game/sim/customers';
import { noteOrder } from '../../game/sim/stations/counter';
import { ticketLabel, ticketOf } from '../../game/sim/tickets';
import { devConfig } from '../testConfig';
import { advance, check, checkEq, checkNear, fillCmd, makeSim, type Scenario } from '../harness';
import type { DaySim } from '../../game/sim/day';
import type { Command } from '../../game/types';
import { unmet } from '../../game/sim/production';
import { crewSim, member } from './posicoes';

/** Sem chegadas aleatórias: o cenário controla os clientes. */
const quiet = (seed: number, config = devConfig()) => {
  const sim = makeSim(seed, config);
  sim.state.arrivalLeft = 1e9;
  return sim;
};

const slot = (sim: DaySim, station: 'balcao' | 'mesas', k: 'anotar') => {
  sim.dispatch({ type: 'tapSlot', station, slot: { k } } as Command);
  sim.step();
};
const send = (sim: DaySim, cmd: Command) => {
  sim.dispatch(cmd);
  sim.step();
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
      c.lines.push({ item: 'queijo', gift: true, filled: null });
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
  {
    id: 'rn186-completa-entrega-sozinha',
    rules: 'RN-186, RN-182, RN-20',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne', 'caldo-puro']);
      slot(sim, 'balcao', 'anotar');
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: s.tick * STEP });
      s.cups.push({ id: 2, item: 'caldo-puro' });
      send(sim, fillCmd(sim, { kind: 'pastel', id: 1 }, c.id));
      checkEq(s.ready.length, 0, 'o pastel sai do balcão e entra na comanda');
      checkEq(s.coins.length, 0, 'comanda incompleta não entrega nada');
      check(ticketOf(s, c.id)!.slots[0].filled !== null, 'o item fica preenchido na comanda');
      send(sim, fillCmd(sim, { kind: 'copo', id: 2 }, c.id));
      checkEq(s.tickets.length, 0, 'comanda completa sai do trilho');
      checkEq(s.customers.length, 0, 'o cliente recebe tudo e sai');
      checkEq(s.coins.length, 1, 'uma moeda só, com o pedido inteiro');
      checkNear(s.coins[0].amount, 7 * (0.8 + 0.4 * 0.8) + 6, 'pastel nota 80 + caldo');
      checkEq(s.rep.successes, 1, 'sucesso');
    },
  },
  {
    id: 'rn182-rn63-versao-errada-entra-e-falha',
    rules: 'RN-182, RN-63',
    run(seed) {
      const sim = quiet(seed, devConfig({ menu: [{ item: 'carne+1', price: 9 }, { item: 'carne', price: 7 }, { item: 'queijo', price: 7 }] }));
      const s = sim.state;
      const c = addCustomer(s, 'exigente', ['carne+1']);
      slot(sim, 'balcao', 'anotar');
      s.ready.push({ id: 1, item: 'carne', quality: 90, readyAt: s.tick * STEP });
      send(sim, fillCmd(sim, { kind: 'pastel', id: 1 }, c.id));
      checkEq(s.tickets.length, 0, 'a versão errada entra e completa a comanda');
      checkEq(s.stats.wrong, 1, 'conta como item errado');
      checkEq(s.coins.length, 1, 'é pago normalmente');
      checkNear(s.rep.failures, 1, 'falha de peso 1,0');
      checkEq(s.rep.successes, 0, 'sem sucesso');
      // quem não é Exigente aceita outra versão do mesmo sabor sem falha
      const d = addCustomer(s, 'padrao', ['carne+1']);
      slot(sim, 'balcao', 'anotar');
      s.ready.push({ id: 2, item: 'carne', quality: 90, readyAt: s.tick * STEP });
      send(sim, fillCmd(sim, { kind: 'pastel', id: 2 }, d.id));
      checkEq(s.rep.successes, 1, 'Padrão aceita a outra versão');
    },
  },
  {
    id: 'rn186-rn83-comanda-de-mesa-leva-o-grupo-a-comer',
    rules: 'RN-186, RN-83, RN-82',
    run(seed) {
      const sim = makeSim(seed, devConfig({ tables: 1, stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'mesas'], positions: ['balcao', 'montagem1', 'fritador1', 'trocador', 'moenda', 'garcom'] }));
      const s = sim.state;
      s.arrivalLeft = 1e9;
      const c = addCustomer(s, 'padrao', ['queijo']);
      c.group = { size: 1, table: 0, seats: [0], profiles: ['padrao'] };
      c.place = 'mesa';
      c.service = 'mesa';
      s.tables[0].seats[0] = 'ocupado';
      noteOrder(s, c);
      const t = ticketOf(s, c.id)!;
      checkEq(ticketLabel(t), 'M1', 'comanda de mesa com o prefixo M');
      s.pasteleiro.at = 'mesas';
      s.ready.push({ id: 1, item: 'queijo', quality: 90, readyAt: s.tick * STEP });
      send(sim, fillCmd(sim, { kind: 'pastel', id: 1 }, c.id));
      checkEq(s.eating.length, 1, 'o grupo passa a comer');
      checkEq(s.tickets.length, 0, 'a comanda M sai do trilho');
    },
  },
  {
    id: 'rn183-fora-da-estacao-nao-preenche',
    rules: 'RN-183',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne']);
      slot(sim, 'balcao', 'anotar');
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: s.tick * STEP });
      s.pasteleiro.at = 'bancada';
      const before = s.rejected;
      send(sim, fillCmd(sim, { kind: 'pastel', id: 1 }, c.id));
      checkEq(s.rejected, before + 1, 'pasteleiro fora do balcão: rejeitado');
      checkEq(s.ready.length, 1, 'o pastel continua pronto');
      send(sim, { type: 'fill', ticketId: 9999, item: { kind: 'pastel', id: 1 } });
      checkEq(s.rejected, before + 2, 'comanda inexistente: rejeitado');
    },
  },
  {
    id: 'rn182-gesto-repetido-vale-uma-vez',
    rules: 'RN-182, spec 4',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne', 'carne']);
      slot(sim, 'balcao', 'anotar');
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: s.tick * STEP });
      s.ready.push({ id: 2, item: 'carne', quality: 80, readyAt: s.tick * STEP });
      const cmd: Command = { ...fillCmd(sim, { kind: 'pastel', id: 1 }, c.id), g: 77 } as Command;
      sim.dispatch(cmd);
      sim.dispatch(cmd);
      sim.step();
      checkEq(ticketOf(s, c.id)!.slots.filter((l) => l.filled !== null).length, 1, 'o item entrou uma vez só');
      checkEq(s.ready.length, 1, 'o outro pastel continua pronto');
    },
  },
  {
    id: 'rn27-pastel-sai-da-estufa-ao-entrar-na-comanda',
    rules: 'RN-27, RN-182',
    run(seed) {
      const sim = quiet(seed, devConfig({ equipment: { drainer: false, warmer: 6, mill: 'manual', thermalBag: false, autoMill: false, cardMachine: false } }));
      const s = sim.state;
      const c = addCustomer(s, 'padrao', ['carne', 'carne']);
      slot(sim, 'balcao', 'anotar');
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: s.tick * STEP, warmed: true });
      send(sim, fillCmd(sim, { kind: 'pastel', id: 1 }, c.id));
      const filled = ticketOf(s, c.id)!.slots[0].filled as { warmed?: boolean };
      checkEq(filled.warmed, false, 'na comanda o pastel não está mais na estufa');
      checkEq(s.ready.filter((r) => r.warmed).length, 0, 'a vaga da estufa liberou');
    },
  },
  {
    id: 'rn187-lista-segue-a-ordem-de-entrada',
    rules: 'RN-187',
    run(seed) {
      const sim = quiet(seed);
      const s = sim.state;
      const a = addCustomer(s, 'padrao', ['carne']);
      const b = addCustomer(s, 'padrao', ['queijo']);
      noteOrder(s, b); // o segundo da fila é anotado antes
      advance(sim, 1);
      noteOrder(s, a);
      checkEq(unmet(s, false).join(','), 'queijo,carne', 'quem entrou antes vem primeiro, não quem está na frente da fila');
      s.ready.push({ id: 900, item: 'queijo', quality: 80, readyAt: s.tick * STEP });
      checkEq(unmet(s, false).join(','), 'carne', 'pronto sem comanda desconta o item');
    },
  },
  {
    id: 'rn187-encomenda-entra-as-7h-sem-prioridade',
    rules: 'RN-187, CE-21',
    run(seed) {
      const sim = makeSim(seed, devConfig({ orders: [{ id: 1, item: 'queijo', qty: 2, pickupAt: 4 * 3600, pay: 30, fine: 15 }] }));
      const s = sim.state;
      s.arrivalLeft = 1e9;
      s.offerLeft = 1e9;
      advance(sim, 10);
      noteOrder(s, addCustomer(s, 'padrao', ['carne']));
      checkEq(unmet(s, false).join(','), 'queijo,queijo,carne', 'a encomenda entrou às 7h, antes do cliente');
    },
  },
  {
    id: 'rn187-montagem-produz-na-ordem-da-lista',
    rules: 'RN-187, RN-40',
    run(seed) {
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'montagem1' })]);
      const s = sim.state;
      sim.step();
      const a = addCustomer(s, 'padrao', ['carne']);
      const b = addCustomer(s, 'padrao', ['queijo']);
      noteOrder(s, b);
      advance(sim, 1);
      noteOrder(s, a);
      for (let i = 0; i < 600 && s.assembled.length === 0; i++) sim.step();
      checkEq(s.assembled[0]?.item, 'queijo', 'a Montagem monta primeiro o pedido que entrou primeiro');
    },
  },
  {
    id: 'rn188-balcao-preenche-a-comanda-mais-antiga',
    rules: 'RN-188, RN-40',
    run(seed) {
      const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' })]);
      const s = sim.state;
      sim.step();
      const a = addCustomer(s, 'padrao', ['carne']);
      const b = addCustomer(s, 'padrao', ['carne']);
      noteOrder(s, b); // b entrou antes
      advance(sim, 1);
      noteOrder(s, a);
      s.ready.push({ id: 900, item: 'carne', quality: 80, readyAt: s.tick * STEP });
      advance(sim, Math.round(4 / STEP));
      check(!s.customers.includes(b), 'a comanda mais antiga (b) recebeu o pastel e saiu');
      check(s.customers.includes(a), 'a mais nova continua esperando');
    },
  },
  {
    id: 'rn188-rn118-preencher-leva-1-5-s-e-atendimento-encurta',
    rules: 'RN-188, RN-43, RN-118',
    run(seed) {
      for (const [courses, secs] of [[[], 1.5], [['atendimento'], 1.2]] as const) {
        const sim = crewSim(seed, [member('geral', { mode: 'fixo', position: 'balcao' }, [], [...courses])]);
        const s = sim.state;
        s.pasteleiro.at = 'moenda'; // fora do escritório: sem o bônus de gestão (RN-101)
        sim.step();
        noteOrder(s, addCustomer(s, 'padrao', ['carne']));
        s.ready.push({ id: 900, item: 'carne', quality: 80, readyAt: s.tick * STEP });
        sim.step();
        const task = s.workers[0].task;
        checkEq(task?.kind, 'preencher', 'o Balcão vai pôr na comanda');
        checkNear(task!.total, secs, `tempo de pôr na comanda (${courses.join(',') || 'sem curso'})`, 1e-6);
      }
    },
  },
];
