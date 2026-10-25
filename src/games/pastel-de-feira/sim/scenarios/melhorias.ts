import {
  buyCooler, buyDrink, buyEquipment, buyMenuBoard, buyRecipe, buySpace, buyTachoExtra, buyTachoUpgrade, buyVersion,
} from '../../game/campaign/actions/upgrades';
import { closeDay } from '../../game/campaign/closing';
import { dailySpaceFee, equipmentFlags, freeM2, newCampaign, stationsOf, totalM2, toDayConfig, usedM2 } from '../../game/campaign/campaign';
import type { ActionResult, Campaign, Refusal } from '../../game/campaign/types';
import { isCampaign } from '../../game/campaign/save';
import { check, checkEq, runDay, type Scenario } from '../harness';

const rich = (patch: Partial<Campaign> = {}): Campaign => ({
  ...newCampaign({ profile: 'negociante', eventsOn: false, tutorial: false, seed: 5 }),
  cash: 100000,
  ...patch,
});

function must(r: ActionResult): Campaign {
  check(r.ok, `ação recusada: ${r.ok ? '' : r.motivo}`);
  return r.campaign;
}

function refused(r: ActionResult, motivo: Refusal, msg: string): void {
  check(!r.ok, `${msg}: deveria recusar`);
  if (!r.ok) checkEq(r.motivo, motivo, msg);
}

export const melhorias: Scenario[] = [
  {
    id: 'rn30-receitas-por-dia-e-caixa',
    rules: 'RN-30',
    run() {
      refused(buyRecipe(rich({ day: 5 }), 'palmito'), 'bloqueadoAteDia', 'palmito antes do dia 6');
      refused(buyRecipe(rich({ day: 13 }), 'bacalhau'), 'bloqueadoAteDia', 'bacalhau antes do dia 14');
      refused(buyRecipe(rich({ cash: 50 }), 'frango'), 'semCaixa', 'frango sem caixa (R$ 80)');
      const c = must(buyRecipe(rich({ day: 6 }), 'palmito'));
      check(c.owned.items.includes('palmito'), 'comprou');
      checkEq(c.cash, 100000 - 400, 'preço da receita');
      checkEq(c.prices.palmito, 14, 'preço padrão = 0,9 × 16 no passo');
      refused(buyRecipe(c, 'palmito'), 'limite', 'compra repetida');
      refused(buyRecipe(c, 'inexistente'), 'limite', 'receita inexistente');
      checkEq(c.owned.spent, 0, 'receita não conta como estrutura');
    },
  },
  {
    id: 'rn30a-versoes-em-sequencia',
    rules: 'RN-30a, PA-17',
    run() {
      refused(buyVersion(rich(), 'frango+1'), 'limite', 'frango não tem melhoria');
      refused(buyVersion(rich(), 'chocolate+1'), 'requer', 'precisa da receita base');
      let c = must(buyRecipe(rich(), 'chocolate'));
      refused(buyVersion(c, 'chocolate+2'), 'requer', 'versão 2 sem a 1');
      c = must(buyVersion(c, 'chocolate+1'));
      checkEq(c.cash, 100000 - 200 - 120, 'melhoria 1 custa R$ 120');
      c = must(buyVersion(c, 'chocolate+2'));
      checkEq(c.cash, 100000 - 200 - 120 - 250, 'melhoria 2 custa R$ 250');
      check(c.owned.items.includes('chocolate') && c.owned.items.includes('chocolate+1'), 'as versões convivem');
      refused(buyVersion(c, 'chocolate+2'), 'limite', 'repetida');
      refused(buyVersion(rich({ cash: 10 }), 'carne+1'), 'semCaixa', 'sem caixa');
    },
  },
  {
    id: 'rn31-bebidas',
    rules: 'RN-31',
    run() {
      refused(buyDrink(rich({ cash: 50 }), 'caldo-limao'), 'semCaixa', 'limão R$ 100');
      const c = must(buyDrink(rich(), 'caldo-abacaxi'));
      checkEq(c.cash, 100000 - 180, 'abacaxi R$ 180');
      refused(buyDrink(c, 'caldo-puro'), 'limite', 'já tem o caldo puro');
      refused(buyDrink(c, 'carne'), 'limite', 'não é bebida');
    },
  },
  {
    id: 'rn73-equipamentos-globais',
    rules: 'RN-73',
    run() {
      refused(buyEquipment(rich(), 'estufa-grande'), 'requer', 'estufa grande sem estufa');
      let c = must(buyEquipment(rich(), 'estufa'));
      c = must(buyEquipment(c, 'estufa-grande'));
      refused(buyEquipment(c, 'estufa'), 'limite', 'único');
      refused(buyEquipment(rich({ cash: 100 }), 'moenda-motorizada'), 'semCaixa', 'R$ 500');
      c = must(buyEquipment(c, 'oleo-algodao'));
      check(c.owned.tachos.every((t) => t.oil === 'algodao'), 'óleo de algodão em todos os tachos');
      c = must(buyEquipment(c, 'escorredor'));
      c = must(buyEquipment(c, 'moenda-motorizada'));
      c = must(buyEquipment(c, 'embalagem-termica'));
      checkEq(c.owned.spent, 300 + 350 + 300 + 250 + 500 + 250, 'gasto estrutural acumulado');
      const f = equipmentFlags(c);
      checkEq(f.warmer, 12, 'estufa grande: 12 vagas');
      checkEq(f.mill, 'motorizada', 'moenda');
      check(f.drainer && f.thermalBag, 'flags');
      checkEq(stationsOf(c).join(','), 'balcao,bancada,tacho1,estufa,moenda', 'estufa vira estação');
    },
  },
  {
    id: 'rn71-72-espaco',
    rules: 'RN-70, RN-71, RN-72',
    run() {
      let c = rich();
      checkEq(totalM2(c), 6, 'barraca inicial: 6 m²');
      refused(buyTachoExtra(c), 'semEspaco', 'tacho extra sem 2 m² livres');
      refused(buyCooler(c), 'semEspaco', 'caixa térmica sem 1 m²');
      c = must(buySpace(c, 2));
      checkEq(c.cash, 100000 - 240, 'R$ 120 por m²');
      checkEq(freeM2(c), 2, 'livre');
      c = must(buyTachoExtra(c));
      checkEq(c.owned.tachos.length, 2, 'segundo tacho');
      checkEq(freeM2(c), 0, 'espaço consumido');
      refused(buyTachoExtra(c), 'semEspaco', 'sem espaço de novo');
      c = must(buySpace(c, 5));
      c = must(buyTachoExtra(c));
      refused(buyTachoExtra(c), 'limite', 'máximo de 3 tachos');
      check(usedM2(c) <= c.owned.extraM2, 'o espaço usado nunca passa do comprado');
      refused(buySpace(c, 0), 'limite', 'quantidade inválida');
      refused(buySpace(c, 1.5), 'limite', 'fracionário');
      refused(buySpace(c, 18), 'limite', 'passaria de 24 m²');
      c = must(buySpace(c, 11));
      checkEq(totalM2(c), 24, 'máximo 24 m²');
      refused(buySpace(c, 1), 'limite', 'acima de 24');
      refused(buySpace(rich({ cash: 100 }), 1), 'semCaixa', 'sem caixa');
    },
  },
  {
    id: 'rn73-melhorias-por-tacho',
    rules: 'RN-73',
    run() {
      let c = must(buyTachoUpgrade(rich(), 'grande', 0));
      checkEq(c.owned.tachos[0].baskets, 4, 'tacho grande: 4 cestos');
      refused(buyTachoUpgrade(c, 'grande', 0), 'limite', 'já é grande');
      refused(buyTachoUpgrade(c, 'alarme', 1), 'limite', 'tacho inexistente');
      c = must(buyTachoUpgrade(c, 'termostato', 0));
      c = must(buyTachoUpgrade(c, 'alarme', 0));
      checkEq(100000 - c.cash, 400 + 350 + 60, 'preços por tacho');
      check(c.owned.tachos[0].thermostat && c.owned.tachos[0].alarm, 'flags do tacho');
      refused(buyTachoUpgrade(rich({ cash: 10 }), 'alarme', 0), 'semCaixa', 'sem caixa');
      const cfg = toDayConfig(c);
      checkEq(cfg.tachos[0].baskets, 4, 'DayConfig recebe o tacho grande');
    },
  },
  {
    id: 'rn39-caixa-termica',
    rules: 'RN-39',
    run() {
      let c = must(buySpace(rich(), 3));
      c = must(buyCooler(c));
      c = must(buyCooler(c));
      refused(buyCooler(c), 'limite', 'máximo 2');
      checkEq(c.owned.coolers, 2, 'duas caixas');
      checkEq(toDayConfig(c).coolers, 2, 'DayConfig');
    },
  },
  {
    id: 'rn30b-placas-de-cardapio',
    rules: 'RN-30b',
    run() {
      let c = rich();
      const prices = [150, 300, 450, 600];
      for (let i = 0; i < 4; i++) {
        const before = c.cash;
        c = must(buyMenuBoard(c, 'salgado'));
        checkEq(before - c.cash, prices[i], `placa de ${4 + i} vagas`);
      }
      checkEq(c.owned.slotsSalgado, 7, '7 vagas de salgado');
      refused(buyMenuBoard(c, 'salgado'), 'limite', 'máximo 7');
      c = must(buyMenuBoard(c, 'doce'));
      checkEq(c.owned.slotsDoce, 3, '3 vagas de doce');
      refused(buyMenuBoard(c, 'doce'), 'limite', 'máximo 3');
      refused(buyMenuBoard(rich({ cash: 100 }), 'salgado'), 'semCaixa', 'sem caixa');
    },
  },
  {
    id: 'rn71-taxa-diaria-de-espaco',
    rules: 'RN-71',
    run(seed) {
      let c = must(buySpace(rich(), 10));
      checkEq(dailySpaceFee(c), 80, '10 m² = R$ 80 por dia');
      const cash = c.cash;
      const result = runDay(seed, toDayConfig(c)).result()!;
      const out = closeDay(c, result);
      const line = out.balance.lines.find((l) => l.id === 'espaco');
      checkEq(line?.amount, -80, 'linha do balanço');
      check(Math.abs(out.campaign.cash - (cash - 80)) < 1e-6, 'caixa debitado no fechamento');
      c = rich();
      check(!closeDay(c, runDay(seed, toDayConfig(c)).result()!).balance.lines.some((l) => l.id === 'espaco'), 'sem m² extra, sem taxa');
    },
  },
  {
    id: 'save-valida-espaco-e-equipamentos',
    rules: 'plan 3.3',
    run() {
      let c = must(buySpace(rich(), 2));
      c = must(buyTachoExtra(c));
      c = must(buyEquipment(c, 'estufa'));
      check(isCampaign(JSON.parse(JSON.stringify(c))), 'campanha com melhorias é um save válido');
      const bad = JSON.parse(JSON.stringify(c)) as Campaign;
      bad.owned.extraM2 = 0;
      check(!isCampaign(bad), 'espaço usado acima do comprado é rejeitado');
      const bad2 = JSON.parse(JSON.stringify(c));
      bad2.owned.equip.push('jato-de-agua');
      check(!isCampaign(bad2), 'equipamento inexistente é rejeitado');
    },
  },
];
