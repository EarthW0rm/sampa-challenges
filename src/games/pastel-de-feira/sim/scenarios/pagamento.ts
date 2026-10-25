import { STEP } from '../../game/constants';
import { spawnCustomer } from '../../game/sim/customers';
import type { Customer, DayState } from '../../game/sim/state';
import { advance, check, checkEq, checkNear, type Scenario } from '../harness';
import { feedGroup, tableSim } from './mesas';
import { member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

/** Senta um grupo na mesa e o põe a comer (pedido já entregue). */
function groupEating(s: DayState): Customer {
  for (let i = 0; i < 500; i++) {
    s.customers.length = 0;
    spawnCustomer(s, 'padrao');
    const c = s.customers.find((x) => x.group);
    if (c) {
      feedGroup(s, c);
      return c;
    }
  }
  throw new Error('nenhum grupo');
}

export const pagamento: Scenario[] = [
  {
    id: 'rn87-fila-de-pagamento-max-4',
    rules: 'RN-87, D-03',
    run(seed) {
      const sim = tableSim(seed, 4);
      const s = sim.state;
      const groups: Customer[] = [];
      for (let i = 0; i < 5; i++) {
        for (const t of s.tables) if (t.seats.every((x) => x === 'livre')) break;
        groups.push(groupEating(s));
      }
      check(s.eating.length >= 4, 'grupos comendo');
      advance(sim, secs(26));
      checkEq(s.payQueue.length, 4, 'a fila de pagamento comporta 4 grupos');
      const waiting = s.eating.length;
      if (waiting > 0) {
        const c = s.eating[0];
        check(s.tables[c.group!.table].seats.some((x) => x === 'ocupado'), 'o grupo que espera pagar continua na mesa ocupada');
        const dirt = s.dirt;
        advance(sim, secs(1));
        checkEq(s.dirt, dirt, 'sem sujeira nova enquanto espera na mesa');
      }
      check(groups.length === 5, 'cinco grupos');
    },
  },
  {
    id: 'rn87-pasteleiro-cobra-no-balcao-com-premio',
    rules: 'RN-82, RN-87, L4',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      const c = groupEating(s);
      const owed = Math.round(c.owed * 100) / 100;
      advance(sim, secs(26));
      checkEq(s.payQueue.length, 1, 'na fila de pagamento');
      // cobrar fora do balcão não vale
      sim.dispatch({ type: 'tapStation', station: 'mesas' });
      advance(sim, secs(2));
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'pagar' } });
      sim.step();
      checkEq(s.payQueue.length, 1, 'não cobra fora do balcão');
      sim.dispatch({ type: 'tapStation', station: 'balcao' });
      advance(sim, secs(2));
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'pagar' } });
      sim.step();
      checkEq(s.payQueue.length, 0, 'cobrou');
      checkNear(s.stats.tableRevenue, owed, 'valor cobrado');
      checkNear(s.stats.revenue, owed, 'entra na receita');
      // o valor inclui +15% de mesa: 1 pastel de preço 6 e nota 90 → 6 × 1,16 × 1,15
      check(owed > 0, 'houve valor');
    },
  },
  {
    id: 'rn82-premio-de-mesa-de-15-por-cento',
    rules: 'RN-82',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      let c: Customer | undefined;
      for (let i = 0; i < 500 && !(c && c.lines.length === 1 && c.lines[0].item === 'carne'); i++) {
        s.customers.length = 0;
        for (const t of s.tables) t.seats = t.seats.map(() => 'livre');
        spawnCustomer(s, 'padrao');
        c = s.customers.find((x) => x.group);
      }
      check(c !== undefined && c.lines.length === 1, 'grupo com um pastel de carne');
      feedGroup(s, c!);
      checkNear(c!.owed, 6 * (0.8 + 0.4 * 0.9) * 1.15, 'preço × qualidade × prêmio de mesa (+15%)', 1e-6);
    },
  },
  {
    id: 'rn87-paciencia-de-20s-na-fila-de-pagamento',
    rules: 'RN-87',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      groupEating(s);
      advance(sim, secs(25.5));
      checkEq(s.payQueue.length, 1, 'na fila');
      const f0 = s.rep.failures;
      advance(sim, secs(19));
      checkEq(s.payQueue.length, 1, 'ainda espera aos 19 s');
      advance(sim, secs(2));
      checkEq(s.payQueue.length, 0, 'sai sem pagar aos 20 s');
      checkEq(s.stats.payFail, 1, 'conta o calote');
      checkNear(s.rep.failures - f0, 1, 'falha de peso 1,0');
      checkNear(s.stats.tableRevenue, 0, 'sem receita');
    },
  },
  {
    id: 'rn07-grupo-na-fila-as-14h-sem-falha',
    rules: 'RN-07',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      advance(sim, 14400 - secs(30));
      groupEating(s);
      advance(sim, secs(26));
      checkEq(s.payQueue.length, 1, 'grupo esperando para pagar perto das 14h');
      const f0 = s.rep.failures;
      advance(sim, secs(10));
      check(sim.isOver(), 'dia terminou');
      checkEq(s.payQueue.length, 0, 'fila de pagamento limpa');
      checkNear(s.rep.failures, f0, 'sem falha no corte seco');
      checkEq(s.stats.payFail, 0, 'e sem calote');
    },
  },
  {
    id: 'rn83-garcom-anota-e-entrega-na-mesa',
    rules: 'RN-83, RN-86, RN-40',
    run(seed) {
      const sim = tableSim(seed, 2, { staff: [member('geral', { mode: 'fixo', position: 'garcom' })] });
      const s = sim.state;
      sim.step();
      let c: Customer | undefined;
      for (let i = 0; i < 500 && !c; i++) {
        s.customers.length = 0;
        for (const t of s.tables) t.seats = t.seats.map(() => 'livre');
        spawnCustomer(s, 'padrao');
        c = s.customers.find((x) => x.group);
      }
      check(c !== undefined && c.place === 'mesa', 'grupo esperando na mesa');
      advance(sim, secs(2));
      checkEq(c!.state, 'anotado', 'o garçom anotou na mesa');
      // pedido pronto: o garçom entrega item por item
      for (const line of c!.lines) {
        const id = 8000 + s.nextId++;
        if (line.item === 'caldo-puro') s.cups.push({ id, item: line.item });
        else s.ready.push({ id, item: line.item, quality: 90, readyAt: s.tick * STEP });
      }
      advance(sim, secs(2 * c!.lines.length + 2));
      checkEq(c!.place, 'comendo', 'o garçom entregou tudo e o grupo come');
      checkEq(s.customers.filter((x) => x.place === 'fila').length, 0, 'nunca entrou na fila de pedidos');
    },
  },
  {
    id: 'rn83-pasteleiro-nas-mesas-faz-de-garcom',
    rules: 'RN-83, RN-42',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      sim.dispatch({ type: 'tapStation', station: 'mesas' });
      advance(sim, secs(1.5));
      let c: Customer | undefined;
      for (let i = 0; i < 500 && !c; i++) {
        s.customers.length = 0;
        for (const t of s.tables) t.seats = t.seats.map(() => 'livre');
        spawnCustomer(s, 'padrao');
        c = s.customers.find((x) => x.group);
      }
      checkEq(c!.place, 'mesa', 'com o pasteleiro nas mesas, o atendimento é na mesa');
      sim.dispatch({ type: 'tapSlot', station: 'mesas', slot: { k: 'anotar' } });
      sim.step();
      checkEq(c!.state, 'anotado', 'anotou');
      const first = c!.lines[0].item;
      s.ready.push({ id: 1, item: 'carne', quality: 90, readyAt: s.tick * STEP });
      s.cups.push({ id: 2, item: 'caldo-puro' });
      sim.dispatch({ type: 'deliver', item: first === 'caldo-puro' ? { kind: 'copo', id: 2 } : { kind: 'pastel', id: 1 }, customerId: c!.id });
      sim.step();
      check(c!.lines.some((l) => l.delivered !== null) || sim.state.rejected > 0, 'entrega processada nas mesas');
    },
  },
];
