import { STEP } from '../../game/constants';
import { devConfig } from '../testConfig';
import { Tutorial } from '../../game/tutorial';
import { pendingUnlock, loadSeen, saveSeen, UNLOCKS, type SeenStore } from '../../game/unlocks';
import { addCustomer } from '../../game/sim/customers';
import type { StationId } from '../../game/types';
import { advance, check, checkEq, makeSim, type Scenario } from '../harness';

const secs = (n: number): number => Math.round(n / STEP);

function memory(initial?: string): SeenStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('pastel-de-feira:visto', initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

export const tutorial: Scenario[] = [
  {
    id: 'rn170-primeiro-pedido-guiado',
    rules: 'RN-170',
    run(seed) {
      const sim = makeSim(seed, { ...devConfig(), tutorial: true });
      sim.state.arrivalLeft = 1e9;
      const s = sim.state;
      const tut = new Tutorial();
      const seen: string[] = [];
      let guard = 0;
      const drive = (station: StationId) => {
        sim.dispatch({ type: 'tapStation', station });
        sim.setHold(false);
      };
      // antes do cliente: o roteiro espera e o relógio corre
      let v = tut.observe(s);
      checkEq(v.step, 'anotar', 'começa em anotar');
      checkEq(v.hold, false, 'sem cliente, o relógio não para');
      addCustomer(s, 'padrao', ['queijo']);
      // jogador executa cada passo; o roteiro pausa o relógio enquanto espera
      const clockAt = () => s.tick;
      v = tut.observe(s);
      checkEq(v.hold, true, 'passo guiado pausa o relógio');
      sim.setHold(true);
      const t0 = clockAt();
      advance(sim, secs(2));
      checkEq(clockAt(), t0, 'tick não avança durante o passo guiado');
      // anotar (o pasteleiro já está no balcão)
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'anotar' } });
      sim.step();
      seen.push(tut.observe(s).step ?? 'fim');
      drive('bancada');
      for (let i = 0; i < 40 && s.pasteleiro.at !== 'bancada'; i++) sim.step();
      checkEq(s.pasteleiro.at, 'bancada', 'o deslocamento continua durante a pausa');
      sim.dispatch({ type: 'tapSlot', station: 'bancada', slot: { k: 'ingrediente', id: 'mucarela' } });
      sim.step();
      sim.dispatch({ type: 'tapSlot', station: 'bancada', slot: { k: 'fechar' } });
      sim.step();
      seen.push(tut.observe(s).step ?? 'fim');
      drive('tacho1');
      for (let i = 0; i < 60 && s.pasteleiro.at !== 'tacho1'; i++) sim.step();
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.step();
      v = tut.observe(s);
      seen.push(v.step ?? 'fim');
      checkEq(v.step, 'tirar', 'depois de colocar vem tirar');
      checkEq(v.hold, false, 'cru: o relógio corre até o ponto');
      sim.setHold(false);
      while (!tut.observe(s).hold && guard++ < 3000) sim.step();
      check(tut.observe(s).hold, 'no ponto o relógio para para o jogador agir');
      sim.setHold(true);
      sim.dispatch({ type: 'tapSlot', station: 'tacho1', slot: { k: 'cesto', index: 0 } });
      sim.step();
      seen.push(tut.observe(s).step ?? 'fim');
      check(s.ready.length > 0, 'pastel pronto');
      drive('balcao');
      for (let i = 0; i < 60 && s.pasteleiro.at !== 'balcao'; i++) sim.step();
      sim.dispatch({ type: 'deliver', item: { kind: 'pastel', id: s.ready[0].id }, customerId: s.customers[0].id });
      sim.step();
      check(tut.observe(s).step === 'cobrar', 'entregou: falta cobrar');
      sim.dispatch({ type: 'tapSlot', station: 'balcao', slot: { k: 'moedas' } });
      sim.step();
      v = tut.observe(s);
      checkEq(v.done, true, 'roteiro concluído');
      checkEq(v.hold, false, 'sem pausa depois do fim');
      checkEq(seen.join(','), 'montar,colocar,tirar,entregar', 'passos na ordem (caldo pulado: pedido sem caldo)');
    },
  },
  {
    id: 'rn170-pausa-nao-pausa-comandos',
    rules: 'RN-170',
    run(seed) {
      const sim = makeSim(seed, { ...devConfig(), tutorial: true });
      sim.state.arrivalLeft = 1e9;
      sim.setHold(true);
      const t0 = sim.state.tick;
      sim.dispatch({ type: 'tapStation', station: 'bancada' });
      advance(sim, 60);
      checkEq(sim.state.tick, t0, 'relógio parado');
      checkEq(sim.state.pasteleiro.at, 'bancada', 'comando aplicado e pasteleiro chegou');
      sim.setHold(false);
      sim.step();
      checkEq(sim.state.tick, t0 + 1, 'relógio volta');
    },
  },
  {
    id: 'rn171-balao-delivery-uma-vez',
    rules: 'RN-171',
    run() {
      checkEq(pendingUnlock(4, [])?.id, 'equipe', 'dia 4: só os anteriores (equipe primeiro)');
      checkEq(pendingUnlock(4, ['equipe', 'associacao']), null, 'dia 4 sem delivery');
      const store = memory();
      let seen = loadSeen(store);
      const day5 = ['equipe', 'associacao'];
      saveSeen(store, day5);
      seen = loadSeen(store);
      checkEq(pendingUnlock(5, seen)?.id, 'delivery', 'dia 5: delivery aparece');
      seen.push('delivery');
      saveSeen(store, seen);
      checkEq(pendingUnlock(5, loadSeen(store))?.id, 'tema', 'depois de visto, não repete');
      checkEq(UNLOCKS.filter((u) => u.id === 'delivery').length, 1, 'um só balão de delivery');
    },
  },
  {
    id: 'visto-corrompido-vira-vazio',
    rules: 'JA-11',
    run() {
      checkEq(loadSeen(memory('{nao e json')).length, 0, 'JSON inválido');
      checkEq(loadSeen(memory('{"a":1}')).length, 0, 'forma errada');
      checkEq(loadSeen(null).length, 0, 'sem storage');
      checkEq(loadSeen(memory('["a",3,"b"]')).join(','), 'a,b', 'só strings');
      const quebrado: SeenStore = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
      checkEq(loadSeen(quebrado).length, 0, 'getItem lança');
      saveSeen(quebrado, ['a']); // não lança
    },
  },
];
