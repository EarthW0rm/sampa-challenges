import { PATIENCE, STEP } from '../../game/constants';
import { addCustomer, spawnCustomer } from '../../game/sim/customers';
import { deliverItem } from '../../game/sim/stations/counter';
import { advance, check, checkEq, checkNear, type Scenario } from '../harness';
import { tableSim } from './mesas';
import { member } from './posicoes';

const secs = (n: number): number => Math.round(n / STEP);

export const sujeira: Scenario[] = [
  {
    id: 'rn131-fontes-de-sujeira',
    rules: 'RN-130, RN-131',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      checkEq(s.dirt, 0, 'começa limpa');
      // +1 por pedido entregue
      const c = addCustomer(s, 'padrao', ['carne']);
      c.state = 'anotado';
      s.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: 0 });
      deliverItem(s, { kind: 'pastel', id: 1 }, c.id);
      checkEq(s.dirt, 1, '+1 por pedido entregue');
      // +3 por pastel queimado e +5 por troca de óleo
      s.assembled.push({ id: 5, item: 'carne' });
      sim.dispatch({ type: 'tapStation', station: 'tacho1' });
      advance(sim, secs(1));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      advance(sim, secs(11));
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.step();
      checkEq(s.dirt, 4, '+3 por pastel queimado');
      sim.dispatch({ type: 'holdStart', station: 'tacho1', action: 'oleo' });
      advance(sim, secs(8.5));
      checkEq(s.dirt, 9, '+5 por troca de óleo');
    },
  },
  {
    id: 'rn133-efeitos-dos-limiares',
    rules: 'RN-16, RN-133',
    run(seed) {
      // paciência −20% com sujeira ≥ 60
      const limpa = tableSim(seed, 0);
      const suja = tableSim(seed, 0);
      suja.state.dirt = 60;
      const a = addCustomer(limpa.state, 'padrao', ['carne']);
      const b = addCustomer(suja.state, 'padrao', ['carne']);
      a.state = 'anotado'; // a paciência só conta depois de anotar (RN-06)
      b.state = 'anotado';
      advance(limpa, secs(10));
      advance(suja, secs(10));
      checkNear(a.patience, PATIENCE.padrao - 10, 'barraca limpa: 10 s gastam 10 s', 0.05);
      checkNear(b.patience, PATIENCE.padrao - 10 / 0.8, 'barraca suja: a paciência gasta 25% mais rápido (−20% de duração)', 0.05);
      // Exigentes não entram a partir de 60
      const s = suja.state;
      s.customers.length = 0;
      spawnCustomer(s, 'exigente');
      checkEq(s.customers.length, 0, 'Exigente não entra com sujeira 60');
      checkEq(s.stats.lostDirt, 1, 'contado como perdido por sujeira');
      checkNear(s.rep.failures, 0, 'sem falha de reputação');
      spawnCustomer(s, 'padrao');
      check(s.customers.length >= 1, 'Padrão entra');
      const clean = limpa.state;
      spawnCustomer(clean, 'exigente');
      check(clean.customers.length >= 1, 'com a barraca limpa, o Exigente entra');
      // +0,25 de falha por pedido entregue com sujeira ≥ 80
      s.dirt = 80;
      s.customers.length = 0;
      const c = addCustomer(s, 'padrao', ['carne']);
      c.state = 'anotado';
      s.ready.push({ id: 1, item: 'carne', quality: 90, readyAt: s.tick * STEP });
      const before = s.rep.failures;
      deliverItem(s, { kind: 'pastel', id: 1 }, c.id);
      checkNear(s.rep.failures - before, 0.25, '+0,25 de falha');
      checkEq(s.rep.successes, 1, 'o pedido segue contando como sucesso');
      s.dirt = 79;
      const d = addCustomer(s, 'padrao', ['carne']);
      d.state = 'anotado';
      s.ready.push({ id: 2, item: 'carne', quality: 90, readyAt: s.tick * STEP });
      const b2 = s.rep.failures;
      deliverItem(s, { kind: 'pastel', id: 2 }, d.id);
      checkNear(s.rep.failures - b2, 0, 'abaixo de 80 não pesa');
    },
  },
  {
    id: 'dirt-clamp-0-100',
    run(seed) {
      const sim = tableSim(seed, 0);
      const s = sim.state;
      s.dirt = 99;
      const c = addCustomer(s, 'padrao', ['carne']);
      c.state = 'anotado';
      s.ready.push({ id: 1, item: 'carne', quality: 90, readyAt: 0 });
      deliverItem(s, { kind: 'pastel', id: 1 }, c.id);
      checkEq(s.dirt, 100, 'limitada a 100');
    },
  },
  {
    id: 'rn132-pasteleiro-limpa-com-vassoura-e-mesa',
    rules: 'RN-42, RN-84, RN-132',
    run(seed) {
      const sim = tableSim(seed, 2);
      const s = sim.state;
      s.dirt = 60;
      sim.dispatch({ type: 'tapStation', station: 'balcao' });
      advance(sim, secs(2));
      sim.dispatch({ type: 'holdStart', station: 'balcao', action: 'limpar' });
      advance(sim, secs(3.5));
      checkEq(s.dirt, 60, 'ainda não aos 3,5 s');
      advance(sim, secs(1));
      checkNear(s.dirt, 35, 'vassoura: −25 em 4 s');
      // soltar antes cancela
      s.dirt = 50;
      sim.dispatch({ type: 'holdStart', station: 'balcao', action: 'limpar' });
      advance(sim, secs(2));
      sim.dispatch({ type: 'holdEnd' });
      advance(sim, secs(5));
      checkEq(s.dirt, 50, 'cancelada, nada limpo');
      // mesa suja: 3 s limpa todos os lugares
      s.tables[0].seats = ['sujo', 'sujo', 'ocupado', 'sujo'];
      sim.dispatch({ type: 'tapStation', station: 'mesas' });
      advance(sim, secs(2));
      sim.dispatch({ type: 'holdStart', station: 'mesas', action: 'limpar' });
      advance(sim, secs(3.2));
      checkEq(s.tables[0].seats.join(','), 'livre,livre,ocupado,livre', 'os lugares sujos da mesa ficam limpos');
      sim.dispatch({ type: 'holdStart', station: 'mesas', action: 'limpar' });
      sim.step();
      checkEq(sim.state.rejected > 0, true, 'sem mesa suja, não há o que limpar');
    },
  },
  {
    id: 'rn132-ajudante-limpa-10-a-cada-3s',
    rules: 'RN-132, RN-84',
    run(seed) {
      const sim = tableSim(seed, 2, { staff: [member('geral', { mode: 'fixo', position: 'ajudante' })] });
      const s = sim.state;
      s.dirt = 50;
      sim.step();
      advance(sim, secs(3.1));
      checkNear(s.dirt, 40, 'primeiros 10 pontos em 3 s', 0.01);
      advance(sim, secs(6.2));
      checkNear(s.dirt, 20, 'mais 20 em 6 s', 0.01);
      advance(sim, secs(10));
      checkEq(s.dirt, 0, 'zera e fica em 0');
      // mesa suja tem prioridade: 3 s
      s.tables[1].seats = ['sujo', 'livre', 'livre', 'livre'];
      s.dirt = 30;
      advance(sim, secs(3.2));
      checkEq(s.tables[1].seats[0], 'livre', 'o Ajudante limpou a mesa em 3 s');
      checkEq(s.dirt, 30, 'antes de varrer a barraca');
      // curso de Higiene: 30% mais rápido
      const h = tableSim(seed, 2, { staff: [member('geral', { mode: 'fixo', position: 'ajudante' }, [], ['higiene'])] });
      h.state.dirt = 50;
      h.step();
      advance(h, secs(2.2));
      checkNear(h.state.dirt, 40, 'com Higiene o primeiro ciclo leva 2,1 s', 0.01);
    },
  },
  {
    id: 'rn118-higiene-reduz-a-sujeira-gerada',
    rules: 'RN-118',
    run(seed) {
      const sim = tableSim(seed, 0, { staff: [member('geral', { mode: 'fixo', position: 'balcao' }, [], ['higiene'])] });
      const s = sim.state;
      sim.step();
      const c = addCustomer(s, 'padrao', ['carne']);
      c.state = 'anotado';
      s.ready.push({ id: 1, item: 'carne', quality: 90, readyAt: s.tick * STEP });
      advance(sim, secs(3));
      checkNear(s.dirt, 0.7, 'a entrega do funcionário com Higiene gera 30% menos sujeira', 0.01);
    },
  },
];
