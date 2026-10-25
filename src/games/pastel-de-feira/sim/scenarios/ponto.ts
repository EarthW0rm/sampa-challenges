import { handoverValue, startFromHandover } from '../../game/campaign/actions/handover';
import { newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { isCampaign } from '../../game/campaign/save';
import type { Campaign } from '../../game/campaign/types';
import { loadCashRecord, loadHubRecord, loadPointRecord, loadRecord, saveCashRecord, saveDayRecord, savePointRecord } from '../../game/record';
import { check, checkEq, checkNear, runDay, type Scenario } from '../harness';

const camp = (patch: Partial<Campaign> = {}): Campaign => ({ ...newCampaign({ profile: 'negociante', eventsOn: false, tutorial: false, seed: 6 }), ...patch });
const owned = (spent: number) => ({ ...camp().owned, spent });

class Mem {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

export const ponto: Scenario[] = [
  {
    id: 'rn57-ponto-zerado',
    rules: 'RN-57, JA-08',
    run() {
      checkEq(handoverValue(camp({ cash: 2000, owned: owned(4000) }), 'zerado'), null, 'só vale depois de zerar');
      const c = camp({ cash: 2000, owned: owned(4000), freeMode: true, day: 25 });
      checkEq(handoverValue(c, 'zerado'), 4000, 'R$ 2.000 de caixa + 50% de R$ 4.000 = R$ 4.000');
      const nova = startFromHandover(4000, { profile: 'gestor', eventsOn: true, tutorial: false, seed: 9 });
      checkEq(nova.cash, 1000, 'campanha nova: R$ 200 + 20% do valor');
      checkEq(nova.reputation, 3, 'reputação 3,0');
      checkEq(nova.day, 1, 'dia 1');
      checkEq(nova.profile, 'gestor', 'novo perfil');
      check(nova.history.length === 0 && nova.inventory.length === 0 && nova.owned.spent === 0, 'começa do zero');
      check(isCampaign(JSON.parse(JSON.stringify(nova))), 'save válido');
      checkEq(startFromHandover(0, { profile: 'tradicional', eventsOn: false, tutorial: false, seed: 1 }).cash, 300, 'o perfil Tradicional soma R$ 100');
    },
  },
  {
    id: 'rn52-57-ponto-na-falencia-a-partir-do-dia-10',
    rules: 'RN-52, RN-57',
    run() {
      const falida = (day: number) => camp({ cash: -50, day, owned: owned(4000) });
      checkEq(handoverValue(falida(9), 'falencia'), null, 'não oferece antes do dia 10');
      checkEq(handoverValue(falida(10), 'falencia'), 1000, '25% do investido, sem o caixa negativo');
      checkEq(handoverValue(camp({ cash: 500, day: 12, owned: owned(4000) }), 'falencia'), null, 'sem falência não vale');
      const nova = startFromHandover(1000, { profile: 'chapeiro', eventsOn: false, tutorial: false, seed: 2 });
      checkEq(nova.cash, 400, 'R$ 200 + 20% de R$ 1.000');
    },
  },
  {
    id: 'rn54-modo-livre-e-falencia-no-fechamento',
    rules: 'RN-52, RN-54',
    run(seed) {
      const c = camp({ day: 12, cash: 0.5, owned: owned(3000) });
      const r = runDay(seed, toDayConfig(c)).result()!;
      r.costs.oil = 5;
      const out = closeDay(c, r);
      checkEq(out.balance.bankrupt, true, 'falência');
      checkEq(handoverValue(out.campaign, 'falencia'), 750, 'oferece o ponto (dia ≥ 10)');
      const cedo = closeDay(camp({ day: 5, cash: 0.5 }), r);
      checkEq(handoverValue(cedo.campaign, 'falencia'), null, 'antes do dia 10 não há ponto');
    },
  },
  {
    id: 'rn56-recordes-so-aumentam-e-card-do-hub',
    rules: 'RN-56',
    run() {
      const st = new Mem();
      checkEq(loadHubRecord(st), 0, 'sem recorde');
      saveDayRecord(12, st);
      checkEq(loadHubRecord(st), 12, 'o card mostra o maior dia');
      saveDayRecord(9, st);
      checkEq(loadRecord(st), 12, 'só aumenta');
      saveCashRecord(5321.7, st);
      checkEq(loadHubRecord(st), 5321, 'em modo livre o card mostra o maior caixa');
      saveCashRecord(100, st);
      checkEq(loadCashRecord(st), 5321, 'o maior caixa não diminui');
      savePointRecord(4000, st);
      savePointRecord(1000, st);
      checkEq(loadPointRecord(st), 4000, 'maior valor de ponto');
      checkNear(loadHubRecord(null), 0, 'sem storage');
    },
  },
];
