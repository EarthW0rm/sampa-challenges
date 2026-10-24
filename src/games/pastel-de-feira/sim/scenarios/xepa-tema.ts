import { STEP } from '../../game/constants';
import { buyIngredient } from '../../game/campaign/actions/inventory';
import { chooseTheme, setPromo } from '../../game/campaign/actions/menu';
import { newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import { addCustomer, minQuality, profileShares, salePrice, spawnCustomer, tablePremium, xepaActive } from '../../game/sim/customers';
import { deliverItem } from '../../game/sim/stations/counter';
import { devConfig } from '../testConfig';
import { advance, check, checkEq, checkNear, makeSim, runDay, type Scenario } from '../harness';
import { tableConfig } from './mesas';

const secs = (n: number): number => Math.round(n / STEP);
/** Segundos do dia até uma hora do relógio (7h = 0 s). */
const atHour = (h: number): number => ((h - 7) * 240) / 7;
const fresh = (patch: Partial<Campaign> = {}): Campaign => ({ ...newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed: 4 }), cash: 5000, ...patch });
function must(r: ActionResult): Campaign {
  check(r.ok, 'ação recusada');
  return r.campaign;
}

export const xepaTema: Scenario[] = [
  {
    id: 'rn124-xepa-so-depois-das-13h',
    rules: 'RN-124',
    run(seed) {
      const sim = makeSim(seed, tableConfig(0, { promo: { brindeN: 0, chorinho: 0, xepa: true, xepaDiscount: 0.3 } }));
      sim.state.arrivalLeft = 1e9;
      advance(sim, secs(atHour(12.9)));
      check(!xepaActive(sim.state), 'antes das 13h não vale');
      checkNear(salePrice(sim.state, 'carne'), 6, 'preço cheio antes da xepa');
      advance(sim, secs(atHour(13.1) - atHour(12.9)));
      check(xepaActive(sim.state), 'depois das 13h vale');
      checkNear(salePrice(sim.state, 'carne'), 4.2, '30% de desconto');
      const off = makeSim(seed, tableConfig(0));
      off.state.tick = secs(atHour(13.5));
      check(!xepaActive(off.state), 'desligada nunca vale');
    },
  },
  {
    id: 'rn124-xepa-atrai-economicos-e-baixa-o-teto',
    rules: 'RN-124',
    run(seed) {
      const count = (xepa: boolean) => {
        const sim = makeSim(seed, tableConfig(0, { day: 1, promo: { brindeN: 0, chorinho: 0, xepa, xepaDiscount: 0.5 }, menu: [{ item: 'carne', price: 7 }, { item: 'queijo', price: 7 }] }));
        const s = sim.state;
        s.tick = secs(atHour(13.5));
        let eco = 0;
        const N = 4000;
        for (let i = 0; i < N; i++) {
          s.customers.length = 0;
          spawnCustomer(s);
          if (s.customers[0]?.profile === 'economico') eco++;
        }
        return eco / N;
      };
      const sem = count(false);
      const com = count(true);
      check(com > sem * 1.1, `Econômicos sobem na xepa (${sem.toFixed(2)} → ${com.toFixed(2)})`);
      // com 50% de desconto, o preço de xepa cabe no teto do Econômico (R$ 3,50 ≤ 0,9 × 8)
      const sim = makeSim(0, tableConfig(0, { promo: { brindeN: 0, chorinho: 0, xepa: true, xepaDiscount: 0.5 }, menu: [{ item: 'carne', price: 8 }] }));
      sim.state.tick = secs(atHour(13.5));
      let comprou = 0;
      for (let i = 0; i < 100; i++) {
        sim.state.customers.length = 0;
        spawnCustomer(sim.state, 'economico');
        if (sim.state.customers.length) comprou++;
      }
      checkEq(comprou, 100, 'o teto é calculado sobre o preço de xepa');
      const pago = makeSim(1, tableConfig(0, { promo: { brindeN: 0, chorinho: 0, xepa: true, xepaDiscount: 0.5 }, menu: [{ item: 'carne', price: 8 }] }));
      pago.state.tick = secs(atHour(13.5));
      const c = addCustomer(pago.state, 'padrao', ['carne']);
      c.state = 'anotado';
      pago.state.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: pago.state.tick * STEP });
      deliverItem(pago.state, { kind: 'pastel', id: 1 }, c.id);
      checkNear(c.owed, 4 * (0.8 + 0.4 * 0.8), 'paga o preço de xepa');
    },
  },
  {
    id: 'rn125-sobras-vendidas-a-30-por-cento',
    rules: 'RN-125, RN-37',
    run(seed) {
      let c = fresh({ promo: { brindeN: 0, chorinho: 0, xepa: true, xepaDiscount: 0.3 } });
      c = must(buyIngredient(c, 'carne', 10));
      c = must(buyIngredient(c, 'massa', 5));
      const r = runDay(seed, toDayConfig(c)).result()!;
      const out = closeDay(c, r);
      const line = out.balance.lines.find((l) => l.id === 'xepa');
      checkNear(line!.amount, 10 * 1.5 * 0.3, 'sobras de recheio a 30% do custo');
      checkEq(out.balance.spoiledUnits, 0, 'não contam como desperdício');
      const sem = closeDay({ ...c, promo: { ...c.promo, xepa: false } }, r);
      check(!sem.balance.lines.some((l) => l.id === 'xepa'), 'sem xepa, as sobras estragam');
      checkEq(sem.balance.spoiledUnits, 10, 'estragadas');
    },
  },
  {
    id: 'rn17-escolha-e-troca-do-tema',
    rules: 'RN-17, PA-19',
    run() {
      const antes = chooseTheme(fresh({ day: 4 }), 'gourmet');
      check(!antes.ok && antes.motivo === 'bloqueadoAteDia', 'antes do dia 5');
      let c = must(chooseTheme(fresh({ day: 5 }), 'popular'));
      checkEq(c.theme, 'popular', 'escolhido');
      checkEq(c.cash, 5000, 'a primeira escolha é grátis');
      const igual = chooseTheme(c, 'popular');
      check(!igual.ok && igual.motivo === 'limite', 'mesmo tema');
      c = must(chooseTheme(c, 'gourmet'));
      checkEq(c.cash, 4500, 'trocar custa R$ 500');
      const pobre = chooseTheme({ ...c, cash: 100 }, 'tradicional');
      check(!pobre.ok && pobre.motivo === 'semCaixa', 'sem caixa');
    },
  },
  {
    id: 'rn17-popular-mais-economicos-e-limiar-75',
    rules: 'RN-17',
    run() {
      const base = profileShares(1, 8, 1);
      const pop = profileShares(1, 8, 1, 'popular');
      checkNear(pop.economico - base.economico, 0.15, '+15 pp de Econômicos');
      checkNear(pop.economico + pop.padrao + pop.exigente, 1, 'soma 1');
      const c = must(chooseTheme(fresh({ day: 5 }), 'popular'));
      checkEq(toDayConfig(c).dirtLimit, 75, 'limiar de sujeira sobe para 75');
      checkEq(toDayConfig(must(chooseTheme(fresh({ day: 5 }), 'gourmet'))).dirtLimit, undefined, 'só o Popular muda o limiar');
    },
  },
  {
    id: 'rn17-gourmet-exigentes-exigencia-e-mesa',
    rules: 'RN-17',
    run(seed) {
      const base = profileShares(1, 8, 1);
      const gou = profileShares(1, 8, 1, 'gourmet');
      checkNear(gou.exigente - base.exigente, 0.15, '+15 pp de Exigentes');
      checkNear(gou.economico + gou.padrao + gou.exigente, 1, 'soma 1');
      const g = makeSim(seed, devConfig({ theme: 'gourmet' })).state;
      const t = makeSim(seed, devConfig({ theme: 'tradicional' })).state;
      checkEq(minQuality(g, 'padrao'), 60, 'exigência +10 no Gourmet');
      checkEq(minQuality(t, 'padrao'), 50, 'sem o tema, a exigência base');
      checkNear(tablePremium(g), 1.25, 'prêmio de mesa +10%');
      checkNear(tablePremium(t), 1.15, 'prêmio de mesa padrão');
      checkNear(profileShares(1, 8, 1, 'tradicional').economico, base.economico, 'Tradicional mantém a mistura');
    },
  },
  {
    id: 'rn17-tradicional-reputacao-positiva-10-por-cento',
    rules: 'RN-17',
    run(seed) {
      const win = (theme: 'tradicional' | 'popular') => {
        const c = fresh({ theme, reputation: 3 });
        const r = runDay(seed, toDayConfig(c)).result()!;
        r.reputation = { successes: 5, charm: 0, weightedFailures: 0, rate: 1, change: 0.5 };
        return closeDay(c, r).campaign.reputation;
      };
      checkNear(win('tradicional'), 3.55, 'variação positiva ×1,1');
      checkNear(win('popular'), 3.5, 'outros temas sem bônus');
    },
  },
  {
    id: 'promo-dentro-das-faixas',
    rules: 'spec 4',
    run() {
      let c = fresh();
      c = setPromo(c, { brindeN: 1 });
      checkEq(c.promo.brindeN, 2, 'N mínimo 2');
      c = setPromo(c, { brindeN: 99 });
      checkEq(c.promo.brindeN, 6, 'N máximo 6');
      c = setPromo(c, { brindeN: 0 });
      checkEq(c.promo.brindeN, 0, 'desligado');
      c = setPromo(c, { chorinho: 9 });
      checkEq(c.promo.chorinho, 3, 'chorinho até 3');
      c = setPromo(c, { chorinho: -2 });
      checkEq(c.promo.chorinho, 0, 'não negativo');
      c = setPromo(c, { xepaDiscount: 0.33 });
      checkEq(c.promo.xepaDiscount, 0.3, 'desconto em passos de 10%');
      c = setPromo(c, { xepaDiscount: 9 });
      checkEq(c.promo.xepaDiscount, 0.5, 'máximo 50%');
      check(toDayConfig(c).promo.xepaDiscount === 0.5, 'vai para o DayConfig');
    },
  },
];
