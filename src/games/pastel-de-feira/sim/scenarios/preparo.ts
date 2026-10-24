import { STOCK_CAPACITY } from '../../game/constants';
import { buyConsumable, buyIngredient } from '../../game/campaign/actions/inventory';
import { setPrice, toggleMenuItem } from '../../game/campaign/actions/menu';
import { capacityFree, capacityUsed, cloneCampaign, daySeed, newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { fatigueFactor } from '../../game/campaign/fatigue';
import { clampPrice, defaultPrice } from '../../game/campaign/pricing';
import { openWarning } from '../../game/campaign/warnings';
import { expectedCustomers, suggestPurchase } from '../../game/campaign/suggest';
import type { ActionResult, Campaign } from '../../game/campaign/types';
import { check, checkEq, checkNear, type Scenario } from '../harness';

const fresh = (extra: Partial<Campaign> = {}): Campaign => ({
  ...newCampaign({ profile: 'gestor', eventsOn: false, tutorial: false, seed: 7 }),
  ...extra,
});

function must(r: ActionResult): Campaign {
  check(r.ok, `ação recusada: ${r.ok ? '' : r.motivo}`);
  return r.campaign;
}

export const preparo: Scenario[] = [
  {
    id: 'rn51-campanha-nova',
    rules: 'RN-51, RN-110',
    run() {
      const c = fresh();
      checkEq(c.cash, 200, 'caixa inicial');
      checkEq(c.reputation, 3, 'reputação inicial');
      checkEq(c.day, 1, 'dia 1');
      checkEq(newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: true, seed: 1 }).cash, 300, 'Tradicional +R$ 100');
      checkEq(c.owned.slotsSalgado, 3, 'vagas de salgado');
      checkEq(c.menu.salgados.length, 2, 'cardápio inicial');
    },
  },
  {
    id: 'rn32-34-compra-de-insumo',
    rules: 'RN-32, RN-34, RN-53',
    run() {
      const c0 = fresh();
      const c1 = must(buyIngredient(c0, 'massa', 10));
      checkNear(c1.cash, 200 - 8, 'massa a R$ 0,80');
      checkEq(c0.cash, 200, 'a campanha recebida não é mutada');
      checkEq(c0.inventory.length, 0, 'inventário original intacto');
      checkEq(c1.inventory[0].expires, 3, 'massa do dia 1 vale até o fechamento do dia 3');
      const c2 = must(buyIngredient(c1, 'carne', 4));
      checkEq(c2.inventory.find((l) => l.ingredient === 'carne')!.expires, 1, 'recheio vale só hoje');
      const c3 = must(buyIngredient(c2, 'massa', 5));
      checkEq(c3.inventory.filter((l) => l.ingredient === 'massa').length, 1, 'lotes iguais se juntam');
      checkEq(c3.boughtToday, 19, 'unidades compradas no dia');
    },
  },
  {
    id: 'recusas-de-compra',
    rules: 'RN-38, RN-53, spec 4',
    run() {
      const c = fresh({ cash: 5 });
      let r = buyIngredient(c, 'bacalhau', 2);
      check(!r.ok && r.motivo === 'semCaixa', 'sem caixa');
      const rico = fresh({ cash: 100000 });
      r = buyIngredient(rico, 'massa', STOCK_CAPACITY + 1);
      check(!r.ok && r.motivo === 'semCapacidade', 'acima da capacidade');
      const cheio = must(buyIngredient(rico, 'massa', STOCK_CAPACITY));
      checkEq(capacityFree(cheio), 0, 'capacidade livre');
      checkEq(capacityUsed(cheio), STOCK_CAPACITY, 'capacidade usada');
      r = buyIngredient(cheio, 'carne', 1);
      check(!r.ok && r.motivo === 'semCapacidade', 'estoque cheio');
      for (const qty of [0, -3, 1.5, NaN]) {
        r = buyIngredient(rico, 'carne', qty);
        check(!r.ok && r.motivo === 'limite', `quantidade inválida ${qty}`);
      }
      r = buyIngredient(rico, 'inexistente', 1);
      check(!r.ok && r.motivo === 'limite', 'insumo inexistente');
    },
  },
  {
    id: 'rn39a-consumiveis',
    rules: 'RN-39a',
    run() {
      const c = must(buyConsumable(fresh(), 'copo', 10));
      checkNear(c.cash, 200 - 1.5, 'copo a R$ 0,15');
      checkEq(c.consumables.copo, 10, 'copos');
      checkEq(capacityUsed(c), 0, 'consumível não ocupa capacidade');
      const r = buyConsumable(fresh({ cash: 0.1 }), 'copo', 1);
      check(!r.ok && r.motivo === 'semCaixa', 'sem caixa');
    },
  },
  {
    id: 'rn10-preco-na-faixa-e-no-passo',
    rules: 'RN-10',
    run() {
      checkEq(clampPrice('carne', 1), 4, 'mínimo 50% da referência');
      checkEq(clampPrice('carne', 100), 20, 'máximo 250%');
      checkEq(clampPrice('carne', 7.3), 7.5, 'passo de R$ 0,50');
      checkEq(clampPrice('carne', NaN), 4, 'valor inválido vira o mínimo');
      checkEq(defaultPrice('carne'), 7, 'padrão = teto do Econômico no passo');
      checkEq(defaultPrice('caldo-puro'), 6, 'caldo');
      const c = must(setPrice(fresh(), 'carne', 9.2));
      checkEq(c.prices.carne, 9, 'preço aplicado e ajustado');
      const r = setPrice(fresh(), 'bacalhau', 20);
      check(!r.ok && r.motivo === 'requer', 'item não comprado');
    },
  },
  {
    id: 'rn30b-vagas-do-cardapio',
    rules: 'RN-30b',
    run() {
      const c0 = fresh();
      c0.owned.items.push('frango', 'calabresa', 'bauru');
      let c = must(toggleMenuItem(c0, 'frango', true));
      checkEq(c.menu.salgados.length, 3, 'terceira vaga');
      const r = toggleMenuItem(c, 'calabresa', true);
      check(!r.ok && r.motivo === 'limite', 'só 3 vagas de salgado no início');
      c = must(toggleMenuItem(c, 'carne', false));
      c = must(toggleMenuItem(c, 'calabresa', true));
      check(c.menu.salgados.includes('calabresa') && !c.menu.salgados.includes('carne'), 'trocou carne por calabresa');
      const nao = toggleMenuItem(fresh(), 'bauru', true);
      check(!nao.ok && nao.motivo === 'requer', 'receita não comprada');
      checkEq(must(toggleMenuItem(c, 'calabresa', true)).menu.salgados.length, 3, 'repetir não duplica');
    },
  },
  {
    id: 'rn30c-fadiga-de-cardapio',
    rules: 'RN-30c, D-02',
    run() {
      const c = fresh();
      c.fatigue = { carne: 9 };
      checkEq(fatigueFactor(c, 'carne'), 1, 'com 3 receitas nunca há fadiga');
      c.owned.items.push('frango', 'bauru'); // 4 receitas (carne, queijo, frango, bauru)
      c.fatigue = { carne: 3, queijo: 5, frango: 8, bauru: 20 };
      checkEq(fatigueFactor(c, 'carne'), 1, 'até 3 dias seguidos, sem perda');
      checkNear(fatigueFactor(c, 'queijo'), 0.8, '5 dias seguidos = −20%');
      checkNear(fatigueFactor(c, 'frango'), 0.6, '8 dias = −40%');
      checkNear(fatigueFactor(c, 'bauru'), 0.6, 'limite de −40%');
      checkEq(fatigueFactor(c, 'pizza'), 1, 'receita fora do cardápio');
      c.owned.items.push('carne+1', 'carne+2');
      checkEq(fatigueFactor(c, 'queijo') < 1, true, 'versões não contam como receitas novas (continua com 4)');
    },
  },
  {
    id: 'rn34-validade-no-dayconfig',
    rules: 'RN-34, plan 3.2',
    run() {
      let c = must(buyIngredient(fresh(), 'massa', 10));
      c = must(buyIngredient(c, 'carne', 5));
      let cfg = toDayConfig(c);
      checkEq(cfg.stock.find((l) => l.ingredient === 'massa')!.daysLeft, 3, 'dia 1: 3 dias restantes');
      c.calendar = 3;
      cfg = toDayConfig(c);
      checkEq(cfg.stock.find((l) => l.ingredient === 'massa')!.daysLeft, 1, 'dia 3: último dia');
      checkEq(cfg.menu.find((m) => m.item === 'carne')!.price, 7, 'preço no cardápio do dia');
      checkEq(cfg.stations.join(','), 'balcao,bancada,tacho1,moenda', 'estações da barraca');
    },
  },
  {
    id: 'pa13-semente-do-dia',
    rules: 'PA-13',
    run() {
      const c = fresh();
      const a = daySeed(c);
      checkEq(daySeed(cloneCampaign(c)), a, 'determinística');
      const r = cloneCampaign(c);
      r.resumes = 1;
      check(daySeed(r) !== a, 'retomada muda a semente');
      const d = cloneCampaign(c);
      d.calendar = 2;
      check(daySeed(d) !== a, 'outro dia, outra semente');
      check(a > 0, 'nunca zero');
    },
  },
  {
    id: 'rn36-compra-sugerida',
    rules: 'RN-36',
    run() {
      const c = fresh({ cash: 5000 });
      const s = suggestPurchase(c);
      const total = Object.values(s.ingredients).reduce((n, v) => n + v, 0);
      check(total > 0 && total <= capacityFree(c), `sugerida (${total}) cabe na capacidade`);
      const esperadoClientes = expectedCustomers(c);
      check(esperadoClientes > 15 && esperadoClientes < 35, `clientes esperados no dia 1: ${esperadoClientes}`);
      check((s.ingredients.massa ?? 0) >= esperadoClientes, 'massa cobre ao menos 1 pastel por cliente');
      check((s.consumables.saquinho ?? 0) >= esperadoClientes, 'saquinhos');
      check((s.consumables.copo ?? 0) > 0, 'copos para o caldo');
      check((s.ingredients.carne ?? 0) > 0 && (s.ingredients.mucarela ?? 0) > 0, 'recheios do cardápio');
      check(s.ingredients.bacalhau === undefined, 'nada fora do cardápio');
      // descontando o estoque: quem já tem o suficiente não compra
      let c2 = must(buyIngredient(c, 'massa', s.ingredients.massa ?? 0));
      c2 = must(buyIngredient(c2, 'carne', s.ingredients.carne ?? 0));
      const s2 = suggestPurchase(c2);
      checkEq(s2.ingredients.massa ?? 0, 0, 'massa já coberta');
      checkEq(s2.ingredients.carne ?? 0, 0, 'carne já coberta');
      // limite de capacidade
      const apertado = must(buyIngredient(c, 'massa', STOCK_CAPACITY - 10));
      const s3 = suggestPurchase(apertado);
      check(Object.values(s3.ingredients).reduce((n, v) => n + v, 0) <= 10, 'sugestão limitada à capacidade livre');
    },
  },
  {
    id: 'aviso-antes-de-abrir-sem-insumos',
    rules: 'JA-01',
    run() {
      const c = fresh();
      const w = openWarning(c);
      check(w !== null && w.severe, 'sem nenhum insumo: aviso grave');
      check(w!.lines[0].includes('nenhum insumo'), 'texto claro');
      // compra a sugestão: pode abrir sem aviso
      const sug = suggestPurchase(c);
      let x = c;
      for (const [ing, q] of Object.entries(sug.ingredients)) {
        const r = buyIngredient(x, ing, q);
        if (r.ok) x = r.campaign;
      }
      for (const [id, q] of Object.entries(sug.consumables)) {
        if (q <= 0) continue;
        const r = buyConsumable(x, id as 'copo', q);
        if (r.ok) x = r.campaign;
      }
      checkEq(openWarning(x), null, 'com a compra sugerida não há aviso');
      // falta um insumo do cardápio: aviso não grave dizendo qual item
      const semCarne = { ...x, inventory: x.inventory.filter((l) => l.ingredient !== 'carne') };
      const w2 = openWarning(semCarne);
      check(w2 !== null && !w2.severe && w2.lines.some((l) => l.includes('Carne')), 'falta carne: avisa só o item');
      // sem saquinho
      const semSaco = { ...x, consumables: { ...x.consumables, saquinho: 0 } };
      check(openWarning(semSaco)?.lines.some((l) => l.includes('saquinho')) === true, 'sem saquinhos avisa');
    },
  },
];
