import { STEP } from '../../game/constants';
import { Rng } from '../../game/rng';
import { spawnCustomer } from '../../game/sim/customers';
import { drawGroupSize } from '../../game/sim/stations/tables';
import { deliverItem } from '../../game/sim/stations/counter';
import type { Customer, DayState } from '../../game/sim/state';
import type { DayConfig } from '../../game/types';
import { PATIENCE } from '../../game/constants';
import { devConfig } from '../testConfig';
import { advance, check, checkEq, makeSim, type Scenario } from '../harness';
import { member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

/** Config com mesas, estoque farto e preços que todo perfil aceita. */
export function tableConfig(tables = 2, patch: Partial<DayConfig> = {}): DayConfig {
  return devConfig({
    tables,
    stations: ['balcao', 'bancada', 'tacho1', 'moenda', 'mesas', 'escritorio'],
    positions: ['balcao', 'colocador1', 'fritador1', 'trocador', 'moenda', 'garcom', 'ajudante'],
    menu: [{ item: 'carne', price: 6 }, { item: 'queijo', price: 6 }, { item: 'caldo-puro', price: 5 }],
    stock: [
      { ingredient: 'massa', qty: 9999, daysLeft: 3 },
      { ingredient: 'carne', qty: 9999, daysLeft: 1 },
      { ingredient: 'mucarela', qty: 9999, daysLeft: 1 },
      { ingredient: 'oregano', qty: 9999, daysLeft: 1 },
      { ingredient: 'cana', qty: 9999, daysLeft: 1 },
    ],
    consumables: { copo: 9999, saquinho: 9999, embalagem: 0 },
    ...patch,
  });
}

export function tableSim(seed: number, tables = 2, patch: Partial<DayConfig> = {}) {
  const sim = makeSim(seed, tableConfig(tables, patch));
  sim.state.arrivalLeft = 1e9;
  sim.state.pasteleiro.at = 'escritorio';
  return sim;
}

const resetRoom = (s: DayState) => {
  s.customers.length = 0;
  s.eating.length = 0;
  s.payQueue.length = 0;
  for (const t of s.tables) t.seats = t.seats.map(() => 'livre');
};

/** Entrega ao grupo, um a um, os itens do pedido já prontos (qualidade boa). */
export function feedGroup(s: DayState, c: Customer): void {
  c.state = 'anotado';
  for (const line of c.lines) {
    const id = 9000 + s.nextId++;
    if (line.item === 'caldo-puro') s.cups.push({ id, item: line.item });
    else s.ready.push({ id, item: line.item, quality: 90, readyAt: s.tick * STEP });
    deliverItem(s, { kind: line.item === 'caldo-puro' ? 'copo' : 'pastel', id }, c.id);
  }
}

export const mesas: Scenario[] = [
  {
    id: 'rn85-tamanho-do-grupo',
    rules: 'RN-85',
    run(seed) {
      const rng = new Rng(seed);
      const n = [0, 0, 0, 0];
      for (let i = 0; i < 5000; i++) n[drawGroupSize(rng) - 1]++;
      [0.4, 0.3, 0.2, 0.1].forEach((p, i) => check(Math.abs(n[i] / 5000 - p) < 0.03, `grupos de ${i + 1}: ${n[i] / 50}%`));
    },
  },
  {
    id: 'rn81-30-por-cento-escolhem-mesa',
    rules: 'RN-81',
    run(seed) {
      const sim = tableSim(seed, 4);
      const s = sim.state;
      let groups = 0;
      const N = 3000;
      for (let i = 0; i < N; i++) {
        resetRoom(s);
        spawnCustomer(s, 'padrao');
        if (s.customers.some((c) => c.group)) groups++;
      }
      check(Math.abs(groups / N - 0.3) < 0.03, `${(groups / N) * 100}% dos Padrão escolhem a mesa`);
      // Econômico nunca escolhe mesa
      let eco = 0;
      for (let i = 0; i < 500; i++) {
        resetRoom(s);
        spawnCustomer(s, 'economico');
        if (s.customers.some((c) => c.group)) eco++;
      }
      checkEq(eco, 0, 'Econômico não escolhe mesa');
    },
  },
  {
    id: 'rn82-86-paciencia-e-pedido-do-grupo',
    rules: 'RN-82, RN-86, spec 4',
    run(seed) {
      const sim = tableSim(seed, 4);
      const s = sim.state;
      let seen = 0;
      let mixed = 0;
      for (let i = 0; i < 600 && seen < 40; i++) {
        resetRoom(s);
        spawnCustomer(s, 'padrao');
        const c = s.customers.find((x) => x.group);
        if (!c?.group) continue;
        seen++;
        const min = Math.min(...c.group.profiles.map((p) => PATIENCE[p]));
        check(Math.abs(c.patienceMax - min * 1.5) < 1e-9, `paciência do grupo = menor × 1,5 (${c.patienceMax} vs ${min * 1.5})`);
        check(c.group.size === c.group.profiles.length, 'um perfil por integrante');
        check(c.lines.every((l) => l.profile && c.group!.profiles.includes(l.profile)), 'cada item segue o perfil de quem pediu');
        if (new Set(c.group.profiles).size > 1) mixed++;
        const occupied = s.tables[c.group.table].seats.filter((x) => x === 'ocupado').length;
        checkEq(occupied, c.group.size, 'ocupa um lugar por integrante');
      }
      check(seen >= 40, 'houve grupos suficientes');
      check(mixed > 0, 'houve grupo com perfis diferentes');
    },
  },
  {
    id: 'rn85-sem-mesa-livre-e-limpa-vira-individuais',
    rules: 'RN-85, PA-18',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      // cada mesa com 2 lugares sujos: só cabem grupos de até 2
      for (const t of s.tables) t.seats = ['livre', 'livre', 'sujo', 'sujo'];
      let maxGroup = 0;
      let fallback = 0;
      for (let i = 0; i < 800; i++) {
        s.customers.length = 0;
        for (const t of s.tables) t.seats = ['livre', 'livre', 'sujo', 'sujo'];
        spawnCustomer(s, 'padrao');
        const g = s.customers.find((c) => c.group);
        if (g?.group) maxGroup = Math.max(maxGroup, g.group.size);
        else if (s.customers.length > 1) fallback++;
        check(s.customers.every((c) => c.place === 'fila' || c.group), 'quem não senta fica na fila do balcão');
      }
      check(maxGroup <= 2, `grupo maior que 2 não senta (${maxGroup})`);
      check(fallback > 0, 'grupos grandes viram clientes individuais na fila');
      // sem nenhuma mesa livre: nenhum grupo
      for (const t of s.tables) t.seats = ['sujo', 'sujo', 'sujo', 'sujo'];
      for (let i = 0; i < 200; i++) {
        s.customers.length = 0;
        spawnCustomer(s, 'padrao');
        check(!s.customers.some((c) => c.group), 'mesa suja não recebe grupo');
      }
    },
  },
  {
    id: 'rn83-com-garcom-o-grupo-fica-na-mesa',
    rules: 'RN-83',
    run(seed) {
      const sem = tableSim(seed, 2);
      let g: Customer | undefined;
      for (let i = 0; i < 300 && !g; i++) {
        resetRoom(sem.state);
        spawnCustomer(sem.state, 'padrao');
        g = sem.state.customers.find((c) => c.group);
      }
      check(g !== undefined, 'houve grupo');
      checkEq(g!.place, 'fila', 'sem garçom: entra na fila do balcão');
      checkEq(g!.service, 'balcao', 'atendimento no balcão');
      const com = tableSim(seed, 2, { staff: [member('geral', { mode: 'fixo', position: 'garcom' })] });
      com.step();
      let h: Customer | undefined;
      for (let i = 0; i < 300 && !h; i++) {
        resetRoom(com.state);
        spawnCustomer(com.state, 'padrao');
        h = com.state.customers.find((c) => c.group);
      }
      check(h !== undefined, 'houve grupo com garçom');
      checkEq(h!.place, 'mesa', 'com garçom: espera na mesa');
      checkEq(h!.service, 'mesa', 'atendimento na mesa');
      check(com.state.customers.filter((c) => c.place === 'fila').length === 0, 'o grupo não ocupa a fila de pedidos');
    },
  },
  {
    id: 'rn86-pedido-fecha-so-com-todos-os-itens',
    rules: 'RN-86, RN-82',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      let c: Customer | undefined;
      for (let i = 0; i < 300 && !(c && c.lines.length >= 2); i++) {
        resetRoom(s);
        spawnCustomer(s, 'padrao');
        c = s.customers.find((x) => x.group);
      }
      check(c !== undefined && c.lines.length >= 2, 'grupo com 2+ itens');
      c!.state = 'anotado';
      const first = c!.lines[0].item;
      const id = 7000;
      if (first === 'caldo-puro') s.cups.push({ id, item: first });
      else s.ready.push({ id, item: first, quality: 90, readyAt: 0 });
      deliverItem(s, { kind: first === 'caldo-puro' ? 'copo' : 'pastel', id }, c!.id);
      check(s.customers.includes(c!), 'com um item entregue o pedido ainda está aberto');
      checkEq(s.eating.length, 0, 'ainda não está comendo');
      feedGroup(s, c!);
      check(!s.customers.includes(c!), 'entregue tudo, sai da fila de pedidos');
      checkEq(s.eating.length, 1, 'e vai comer');
      checkEq(c!.place, 'comendo', 'comendo');
      checkEq(s.tables[c!.group!.table].seats.filter((x) => x === 'ocupado').length, c!.group!.size, 'os lugares continuam ocupados enquanto comem');
    },
  },
  {
    id: 'rn82-84-87-sai-junto-e-deixa-sujo',
    rules: 'RN-82, RN-84, RN-131',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      let c: Customer | undefined;
      for (let i = 0; i < 300 && !c; i++) {
        resetRoom(s);
        spawnCustomer(s, 'padrao');
        c = s.customers.find((x) => x.group);
      }
      feedGroup(s, c!);
      const dirt0 = s.dirt;
      advance(sim, secs(24));
      checkEq(s.eating.length, 1, 'ainda come aos 24 s');
      advance(sim, secs(2));
      checkEq(s.eating.length, 0, 'sai aos 25 s');
      checkEq(s.payQueue.length, 1, 'vai para a fila de pagamento');
      const t = s.tables[c!.group!.table];
      checkEq(t.seats.filter((x) => x === 'sujo').length, c!.group!.size, 'todos os lugares do grupo ficam sujos');
      checkEq(s.dirt - dirt0, 2 * c!.group!.size, '+2 de sujeira por cliente de mesa que sai');
    },
  },
];
