import { DAY_TICKS, STEP, hourAt } from '../../game/constants';
import { devConfig } from '../testConfig';
import {
  addCustomer, arrivalInterval, ceilingFor, priceIndex, profileShares, swapDemand,
} from '../../game/sim/customers';
import { consumeIngredient } from '../../game/sim/stock';
import { Rng } from '../../game/rng';
import type { DayConfig, Profile } from '../../game/types';
import { advance, check, checkEq, checkNear, makeSim, type Scenario } from '../harness';

const PROFILES: Profile[] = ['economico', 'padrao', 'exigente'];

/** Passos até uma hora do relógio (7 a 14). */
const tickAtHour = (hour: number): number => Math.round(((hour - 7) * 240) / 7 / STEP);

/** Config de teste com todos os pastéis de Carne e Queijo a 70% da referência, para todo perfil comprar. */
const cheap = (extra: Partial<DayConfig> = {}): DayConfig =>
  devConfig({
    menu: [
      { item: 'carne', price: 6 },
      { item: 'queijo', price: 6 },
      { item: 'caldo-puro', price: 5 },
    ],
    ...extra,
  });

export const clientes: Scenario[] = [
  {
    id: 'rn02-intervalo-chegada',
    rules: 'RN-02',
    run(seed) {
      const sim = makeSim(seed, devConfig({ day: 1 }));
      checkNear(arrivalInterval(sim.state), 12, 'dia 1');
      checkNear(arrivalInterval(makeSim(seed, devConfig({ day: 2 })).state), 12 * 0.96, 'dia 2');
      checkNear(arrivalInterval(makeSim(seed, devConfig({ day: 60 })).state), 4, 'mínimo de 4 s');
      advance(sim, tickAtHour(11));
      checkNear(arrivalInterval(sim.state), 8, 'pico das 10h às 12h: ×1,5');
      advance(sim, tickAtHour(12.5) - sim.state.tick);
      checkNear(arrivalInterval(sim.state), 12, 'fora do pico');
    },
  },
  {
    id: 'rn03-reputacao-baixa',
    rules: 'RN-03',
    run(seed) {
      checkNear(arrivalInterval(makeSim(seed, devConfig({ reputation: 1.5 })).state), 12 / 0.7, 'chegada −30%');
      checkNear(arrivalInterval(makeSim(seed, devConfig({ reputation: 2 })).state), 12, 'a partir de 2 estrelas');
    },
  },
  {
    id: 'rn04-fila-cheia',
    rules: 'RN-04, RN-61',
    run(seed) {
      const sim = makeSim(seed, cheap({ day: 60 }));
      let max = 0;
      for (let i = 0; i < 4000; i++) {
        sim.step();
        max = Math.max(max, sim.state.customers.length);
      }
      check(max <= 6, `fila nunca passa de 6 (chegou a ${max})`);
      check(sim.state.stats.queueFull > 0, 'com fila cheia, clientes são perdidos');
      checkNear(sim.state.rep.failures, sim.state.stats.queueFull * 0.5 + sim.state.stats.lostPatience, 'fila cheia pesa 0,5', 1e-6);
    },
  },
  {
    id: 'rn05-pedido',
    rules: 'RN-05',
    run(seed) {
      const sim = makeSim(seed, cheap({ day: 20 }));
      advance(sim, 3000);
      let vistos = 0;
      for (let i = 0; i < 6000 && vistos < 30; i++) {
        advance(sim, 1);
        for (const c of sim.state.customers) {
          const pastels = c.lines.filter((l) => l.item !== 'caldo-puro').length;
          const caldos = c.lines.length - pastels;
          check(pastels >= 1 && pastels <= 2 && caldos <= 1, `pedido com ${pastels} pastéis e ${caldos} caldos`);
          for (const l of c.lines) check(['carne', 'queijo', 'caldo-puro'].includes(l.item), `item fora do cardápio: ${l.item}`);
          vistos++;
        }
      }
      check(vistos > 0, 'houve clientes');
    },
  },
  {
    id: 'rn06-paciencia',
    rules: 'RN-06',
    run(seed) {
      const sim = makeSim(seed);
      const c = addCustomer(sim.state, 'padrao', ['carne']);
      checkEq(c.patience, 40, 'Padrão 40 s');
      checkEq(addCustomer(sim.state, 'economico', ['carne']).patience, 45, 'Econômico 45 s');
      checkEq(addCustomer(sim.state, 'exigente', ['carne']).patience, 35, 'Exigente 35 s');
      const exi = sim.state.customers[2];
      const eco = sim.state.customers[1];
      sim.state.arrivalLeft = 1e9;
      advance(sim, Math.round(36 / STEP));
      check(sim.state.customers.includes(c), 'Padrão ainda espera aos 36 s');
      check(!sim.state.customers.includes(exi), 'Exigente vai embora aos 35 s');
      advance(sim, Math.round(5 / STEP));
      check(!sim.state.customers.includes(c), 'Padrão vai embora aos 40 s');
      check(sim.state.customers.includes(eco), 'Econômico ainda espera aos 41 s');
      advance(sim, Math.round(5 / STEP));
      checkEq(sim.state.stats.lostPatience, 3, 'três clientes perdidos por paciência');
      checkNear(sim.state.rep.failures, 3, 'falha de peso 1,0 cada');
    },
  },
  {
    id: 'rn12-mistura-de-perfis',
    rules: 'RN-12',
    run(seed) {
      const base = profileShares(1, 8, 1);
      checkNear(base.economico, 0.5, 'base Econômico');
      checkNear(base.padrao, 0.4, 'base Padrão');
      checkNear(base.exigente, 0.1, 'base Exigente');
      const caro = profileShares(1, 8, 1.3);
      checkNear(caro.economico, 0.2, 'caro Econômico');
      checkNear(caro.padrao, 0.5, 'caro Padrão');
      checkNear(caro.exigente, 0.3, 'caro Exigente');
      checkNear(profileShares(1, 8, 2).exigente, 0.3, 'índice acima de 1,3 não passa de 20/50/30');
      // 10.000 clientes sorteados com a mistura base ficam a ±2 p.p.
      const rng = new Rng(seed);
      const n: Record<Profile, number> = { economico: 0, padrao: 0, exigente: 0 };
      for (let i = 0; i < 10000; i++) n[rng.weighted(PROFILES, (p) => base[p])!]++;
      for (const p of PROFILES) check(Math.abs(n[p] / 10000 - base[p]) < 0.02, `distribuição de ${p}: ${n[p] / 100}%`);
    },
  },
  {
    id: 'rn13-14-teto-de-preco',
    rules: 'RN-11, RN-13, RN-14',
    run(seed) {
      checkNear(ceilingFor('economico', 3), 0.9, 'Econômico');
      checkNear(ceilingFor('padrao', 3), 1.2, 'Padrão');
      checkNear(ceilingFor('exigente', 3), 1.6, 'Exigente');
      checkNear(ceilingFor('padrao', 4), 1.2 * 1.1, '4 estrelas +10%');
      checkNear(ceilingFor('padrao', 5), 1.2 * 1.2, '5 estrelas +20%');
      // Tudo a 2× a referência: ninguém compra, sem falha de reputação.
      const caro = makeSim(seed, devConfig({ menu: [{ item: 'carne', price: 16 }, { item: 'queijo', price: 16 }] }));
      advance(caro, 6000);
      check(caro.state.stats.arrived > 5, 'clientes chegaram');
      checkEq(caro.state.stats.lostPrice, caro.state.stats.arrived, 'todos perdidos por preço');
      checkEq(caro.state.customers.length, 0, 'ninguém entra na fila');
      checkNear(caro.state.rep.failures, 0, 'perda por preço não afeta a reputação');
      checkNear(priceIndex(caro.state.config), 2, 'índice de preço');
    },
  },
  {
    id: 'rn19-exigentes-no-fim-do-dia',
    rules: 'RN-19, C-02',
    run() {
      const base = 0.1;
      checkNear(profileShares(6, 13, 1).exigente, base, 'dia 6 às 13h = base');
      checkNear(profileShares(20, 8, 1).exigente, base, 'dia 20 às 8h = base');
      checkNear(profileShares(20, 13, 1).exigente, base * 2, 'dia 20 às 13h = dobro');
      checkNear(profileShares(20, 11, 1).exigente, base * 1.5, 'dia 20 às 11h = rampa');
      checkNear(profileShares(30, 13, 1).exigente, base * 2, 'modo livre fica em +100%');
      const sh = profileShares(20, 13, 1);
      checkNear(sh.economico + sh.padrao + sh.exigente, 1, 'soma 1');
      checkNear(hourAt(tickAtHour(12) * STEP), 12, 'conversão de hora', 1e-3);
    },
  },
  {
    id: 'rn18-35-troca-por-perfil',
    rules: 'RN-18, RN-35, C-01',
    run(seed) {
      // Categoria tradicional com 3 sabores: carne (R$ 7), queijo (R$ 6,5) e frango (R$ 6), com estoques diferentes.
      const config = devConfig({
        menu: [
          { item: 'carne', price: 7 },
          { item: 'queijo', price: 6.5 },
          { item: 'frango', price: 6 },
        ],
        stock: [
          { ingredient: 'massa', qty: 50, daysLeft: 3 },
          { ingredient: 'carne', qty: 10, daysLeft: 1 },
          { ingredient: 'mucarela', qty: 10, daysLeft: 1 },
          { ingredient: 'oregano', qty: 10, daysLeft: 1 },
          { ingredient: 'frango', qty: 3, daysLeft: 1 },
        ],
      });
      const sim = makeSim(seed, config);
      const s = sim.state;
      s.arrivalLeft = 1e9;
      const eco = addCustomer(s, 'economico', ['carne']);
      const pad = addCustomer(s, 'padrao', ['queijo']);
      const exi = addCustomer(s, 'exigente', ['queijo']);
      consumeIngredient(s, 'carne', 10); // acaba a carne
      swapDemand(s);
      checkEq(eco.lines[0].item, 'queijo', 'Econômico leva o sabor com mais unidades disponíveis (queijo: 10 > frango: 3)');
      checkEq(s.customers.includes(exi), true, 'Exigente com queijo disponível não é afetado');
      consumeIngredient(s, 'mucarela', 10); // acaba o queijo
      swapDemand(s);
      checkEq(pad.lines[0].item, 'frango', 'Padrão leva outro de preço igual ou menor (frango R$ 6 ≤ R$ 6,5)');
      checkEq(eco.lines[0].item, 'frango', 'Econômico passa de queijo para frango');
      check(!s.customers.includes(exi), 'Exigente não aceita troca e vai embora');
      checkNear(s.rep.failures, 0.5, 'saída do Exigente: falha de peso 0,5');
      consumeIngredient(s, 'frango', 3);
      swapDemand(s);
      check(s.customers.length === 0, 'sem substituto, todos vão embora');
      checkNear(s.rep.failures, 0.5 * 3, 'três saídas por falta de insumo');
      checkEq(s.stats.noStock, 3, 'contagem de falta de insumo');
    },
  },
  {
    id: 'rn35-producao-cobre-pedidos',
    rules: 'RN-35, spec 4',
    run(seed) {
      const sim = makeSim(seed, devConfig({ menu: [{ item: 'carne', price: 8 }] }));
      const s = sim.state;
      s.arrivalLeft = 1e9;
      const a = addCustomer(s, 'padrao', ['carne']);
      const b = addCustomer(s, 'padrao', ['carne']);
      s.assembled.push({ id: 900, item: 'carne' }); // um pastel já montado cobre o primeiro pedido
      consumeIngredient(s, 'carne', 40);
      swapDemand(s);
      checkEq(a.lines[0].item, 'carne', 'o primeiro pedido segue com o pastel em produção');
      checkEq(s.customers.includes(b), false, 'o segundo, sem cobertura nem substituto, sai');
    },
  },
  {
    id: 'rn07-fila-no-corte-seco',
    rules: 'RN-07',
    run(seed) {
      const sim = makeSim(seed, cheap({ day: 30 }));
      advance(sim, DAY_TICKS - 30);
      check(sim.state.customers.length > 0, 'há clientes na fila perto das 14h');
      const falhas = sim.state.rep.failures;
      advance(sim, 40);
      checkEq(sim.state.customers.length, 0, 'fila vazia depois do corte');
      checkNear(sim.state.rep.failures, falhas, 'corte seco não gera falha', 0.5 + 1e-6);
    },
  },
];
