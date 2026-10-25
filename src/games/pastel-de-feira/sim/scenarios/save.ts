import { newCampaign, cloneCampaign } from '../../game/campaign/campaign';
import { clearSave, load, migrate, MIGRATIONS, saveCampaign, saveCheckpoint, SAVE_KEY, type Migration, type StorageLike } from '../../game/campaign/save';
import type { Campaign } from '../../game/campaign/types';
import { loadCashRecord, loadRecord, saveCashRecord, saveDayRecord } from '../../game/record';
import { closeDay } from '../../game/campaign/closing';
import { setPromo } from '../../game/campaign/actions/menu';
import { daySeed, toDayConfig } from '../../game/campaign/campaign';
import { DaySim } from '../../game/sim/day';
import { restock } from '../bots';
import { Player, playDay } from '../player';
import { check, checkEq, type Scenario } from '../harness';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('bloqueado');
  }
  setItem(): void {
    throw new Error('bloqueado');
  }
  removeItem(): void {
    throw new Error('bloqueado');
  }
}

/** Aceita gravações só abaixo de um limite de tamanho (simula a cota cheia). */
class QuotaStorage extends FakeStorage {
  constructor(private limit: number) {
    super();
  }
  setItem(k: string, v: string) {
    if (v.length > this.limit) throw new Error('QuotaExceededError');
    super.setItem(k, v);
  }
}

const sample = (): Campaign => {
  const c = newCampaign({ profile: 'chapeiro', eventsOn: true, tutorial: true, seed: 99 });
  c.inventory.push({ ingredient: 'massa', qty: 12, unitCost: 0.8, expires: 3, inCooler: false });
  c.consumables.copo = 5;
  c.fatigue = { carne: 2 };
  c.history.push({ day: 1, calendar: 1, revenue: 50, profit: 12, reputation: 3, met: false, served: 5, lost: 2, wasteUnits: 1 });
  return c;
};

const saveWith = (patch: (c: Campaign) => void): FakeStorage => {
  const st = new FakeStorage();
  const c = sample();
  patch(c);
  saveCampaign(st, c, 'preparo');
  return st;
};

const raw = (value: unknown): FakeStorage => {
  const st = new FakeStorage();
  st.setItem(SAVE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  return st;
};

/** `console.warn` silenciado enquanto os saves quebrados são lidos. */
function quiet<T>(fn: () => T): T {
  const orig = console.warn;
  console.warn = () => undefined;
  try {
    return fn();
  } finally {
    console.warn = orig;
  }
}

export const save: Scenario[] = [
  {
    id: 'ida-e-volta-identica',
    rules: 'RN-55',
    run() {
      const st = new FakeStorage();
      const c = sample();
      check(saveCampaign(st, c, 'preparo'), 'gravou');
      const out = load(st);
      check(out.save !== null && out.aviso === undefined, 'carregou sem aviso');
      checkEq(JSON.stringify(out.save!.campaign), JSON.stringify(c), 'save → load idêntico');
      checkEq(out.save!.phase, 'preparo', 'fase');
      check(saveCheckpoint(st, c), 'checkpoint');
      checkEq(load(st).save!.phase, 'dia', 'fase dia');
      clearSave(st);
      checkEq(load(st).save, null, 'limpou');
    },
  },
  {
    id: 'fechamento-com-chorinho-continua-salvavel',
    rules: 'RN-55, RN-123',
    run(seed) {
      // o chorinho gasta 0,1 dose de cana por nível: a sobra é fracionária e o save não pode virar "inválido"
      let c = setPromo(newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed }), { chorinho: 3 });
      c = restock(c);
      const sim = new DaySim(toDayConfig(c), daySeed(c));
      playDay(sim, new Player());
      const out = closeDay(c, sim.result()!).campaign;
      const st = new FakeStorage();
      check(saveCampaign(st, out, 'preparo'), 'gravou');
      const loaded = load(st);
      check(loaded.save !== null && loaded.aviso === undefined, 'o save depois do fechamento é aceito');
      check(out.inventory.every((l) => Math.abs(l.qty * 100 - Math.round(l.qty * 100)) < 1e-6), 'sobras com no máximo 2 casas');
    },
  },
  {
    id: 'sem-save-nao-avisa',
    run() {
      const out = load(new FakeStorage());
      checkEq(out.save, null, 'nada salvo');
      checkEq(out.aviso, undefined, 'sem aviso');
    },
  },
  {
    id: 'dez-saves-corrompidos-sao-rejeitados',
    rules: 'spec 4, plan 3.3',
    run() {
      const bad: [string, FakeStorage][] = [
        ['JSON quebrado', raw('{"version":1,')],
        ['null', raw('null')],
        ['array', raw('[1,2]')],
        ['versão futura', saveWith(() => undefined).getItem(SAVE_KEY) ? raw(JSON.stringify({ ...JSON.parse(saveWith(() => undefined).getItem(SAVE_KEY)!), version: 7 })) : raw('')],
        ['sem campaign', raw({ version: 1, phase: 'preparo' })],
        ['reputação 9', saveWith((c) => (c.reputation = 9))],
        ['reputação 0', saveWith((c) => (c.reputation = 0))],
        ['receita inexistente no cardápio', saveWith((c) => c.menu.salgados.push('lasanha'))],
        ['insumo inexistente no estoque', saveWith((c) => c.inventory.push({ ingredient: 'trufa', qty: 1, unitCost: 1, expires: 1, inCooler: false }))],
        ['quantidade negativa', saveWith((c) => (c.inventory[0].qty = -4))],
        ['caixa não numérico', raw(JSON.stringify({ version: 1, phase: 'preparo', campaign: { ...sample(), cash: 'muito' } }))],
        ['preço fora do passo', saveWith((c) => (c.prices.carne = 7.3))],
        ['perfil inexistente', saveWith((c) => ((c as { profile: string }).profile = 'gourmet-master'))],
        ['item no cardápio sem ser comprado', saveWith((c) => c.menu.salgados.push('bauru'))],
        ['mais salgados que vagas', saveWith((c) => c.owned.items.push('frango', 'calabresa') && c.menu.salgados.push('frango', 'calabresa'))],
        ['histórico acima do limite', saveWith((c) => { for (let i = 0; i < 61; i++) c.history.push(c.history[0]); })],
        ['fase inexistente', raw(JSON.stringify({ version: 1, phase: 'jogando', campaign: sample() }))],
      ];
      check(bad.length >= 10, 'ao menos 10 casos');
      for (const [name, st] of bad) {
        const out = quiet(() => load(st));
        check(out.save === null, `${name}: não pode ser aceito`);
        checkEq(out.aviso, 'invalido', `${name}: aviso`);
      }
    },
  },
  {
    id: 'storage-que-lanca-excecao',
    rules: 'plan 5.1',
    run() {
      const st = new ThrowingStorage();
      const out = load(st);
      checkEq(out.save, null, 'sem save');
      checkEq(out.aviso, 'semPersistencia', 'aviso sem persistência');
      checkEq(saveCampaign(st, sample(), 'preparo'), false, 'gravar devolve false, sem lançar');
      clearSave(st);
      checkEq(load(null).aviso, 'semPersistencia', 'sem storage (modo privado)');
      checkEq(saveCampaign(null, sample(), 'preparo'), false, 'sem storage');
    },
  },
  {
    id: 'cota-cheia-reduz-historico',
    rules: 'plan 5.1',
    run() {
      const c = sample();
      for (let i = 0; i < 59; i++) c.history.push(c.history[0]);
      const full = JSON.stringify({ version: 1, phase: 'preparo', campaign: c }).length;
      const st = new QuotaStorage(Math.floor(full * 0.7));
      check(saveCampaign(st, c, 'preparo'), 'gravou depois de reduzir o histórico');
      const out = load(st);
      check(out.save !== null, 'save válido');
      check(out.save!.campaign.history.length < 60, 'histórico reduzido');
      const tiny = new QuotaStorage(50);
      checkEq(saveCampaign(tiny, c, 'preparo'), false, 'cota impossível: devolve false');
    },
  },
  {
    id: 'migracao-v1-para-v2-colocador-vira-montagem',
    rules: 'plan 3.3, RN-40',
    run() {
      const c = sample();
      const staff = [
        { id: 1, name: 'Zé', kind: 'geral', traits: [], courses: [], mode: 'fixo', position: 'colocador2', trainedToday: false },
        { id: 2, name: 'Bia', kind: 'fritador', traits: [], courses: [], mode: 'fixo', position: 'fritador1', trainedToday: false },
      ];
      const out = load(raw({ version: 1, phase: 'preparo', campaign: { ...c, staff } }));
      check(out.save !== null, 'save v1 migrou e validou');
      checkEq(out.save!.version, 2, 'versão 2');
      checkEq(out.save!.campaign.staff.map((w) => w.position).join(','), 'montagem2,fritador1', 'Colocador 2 vira Montagem 2; o resto fica');
    },
  },
  {
    id: 'migracao-v0-para-v1',
    rules: 'plan 3.3',
    run() {
      const old = { version: 0, phase: 'preparo', campaign: { ...sample(), cash: undefined, money: 321 } };
      const m0: Migration = (s) => {
        const o = s as { campaign: Record<string, unknown> };
        const { money, ...rest } = o.campaign;
        return { ...o, version: 1, campaign: { ...rest, cash: money } };
      };
      const st = raw(old);
      const out = load(st, { ...MIGRATIONS, 0: m0 });
      check(out.save !== null, 'migrou e validou');
      checkEq(out.save!.campaign.cash, 321, 'campo migrado');
      const sem = quiet(() => load(raw(old)));
      checkEq(sem.aviso, 'invalido', 'sem migração conhecida = inválido');
      checkEq(migrate({ version: 1 }, 1, {}) !== undefined, true, 'já na versão alvo');
      checkEq(migrate({ version: 3 }, 1, {}), undefined, 'versão futura não migra');
    },
  },
  {
    id: 'rn56-recorde-so-aumenta',
    rules: 'RN-56',
    run() {
      const st = new FakeStorage();
      checkEq(loadRecord(st), 0, 'sem recorde');
      check(saveDayRecord(5, st), 'gravou 5');
      check(!saveDayRecord(3, st), 'não grava 3');
      check(!saveDayRecord(5, st), 'não grava igual');
      check(saveDayRecord(8, st), 'grava 8');
      checkEq(loadRecord(st), 8, 'maior dia');
      check(saveCashRecord(1234.9, st), 'caixa');
      checkEq(loadCashRecord(st), 1234, 'maior caixa (inteiro)');
      check(!saveDayRecord(NaN, st), 'valor inválido ignorado');
      check(!saveDayRecord(5, new ThrowingStorage()), 'storage com exceção não lança');
      const dirty = new FakeStorage();
      dirty.setItem('pastel-de-feira:recorde', 'abc');
      checkEq(loadRecord(dirty), 0, 'recorde corrompido vale 0');
    },
  },
  {
    id: 'save-nao-muta-a-campanha',
    run() {
      const c = sample();
      const before = JSON.stringify(c);
      saveCampaign(new FakeStorage(), c, 'preparo');
      checkEq(JSON.stringify(c), before, 'campanha intacta');
      checkEq(JSON.stringify(cloneCampaign(c)), before, 'clone idêntico');
    },
  },
];
