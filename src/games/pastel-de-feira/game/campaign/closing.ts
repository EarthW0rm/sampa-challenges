import { XEPA_LEFTOVER_VALUE, THEME_REPUTATION_BONUS } from '../constants';
import { CONSUMABLES, CONSUMABLE_IDS, INGREDIENTS } from '../data/catalog';
import type { DayResult } from '../types';
import { SURPRISE } from '../data/events';
import { rollClaim, rollForecast } from './events';
import { challengeById } from '../data/challenges';
import { payroll } from './actions/staff';
import { advanceFatigue } from './fatigue';
import { CAMPAIGN_DAYS, COOLER_CAPACITY, cloneCampaign, dailySpaceFee, minReputation, profitGoal, round2 } from './campaign';
import type { Balance, BalanceLine, Campaign, InvLot } from './types';

/** Bônus de aproveitamento (RN-37): receita × max(0; 15% − % de desperdício). */
export const BONUS_WASTE_LIMIT = 0.15;
export const HISTORY_MAX = 60;

/**
 * Fecha o dia: aplica o `DayResult` ao estado e devolve o balanço (RN-37, RN-47, RN-50–54, RN-62).
 * Pura e determinística. Meta não cumprida: o dia não avança, o resto persiste (RN-50).
 */
export function closeDay(campaign: Campaign, result: DayResult): { campaign: Campaign; balance: Balance } {
  const c = cloneCampaign(campaign);
  const lines: BalanceLine[] = [];
  const clampMoney = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);

  // 1. Estoque usado e sobras (os lotes do DayConfig são os com qty > 0, na mesma ordem)
  const lotsToday = c.inventory.filter((l) => l.qty > 0);
  let usedCost = 0;
  lotsToday.forEach((lot, i) => {
    const reported = result.stockLeft[i];
    const left = reported?.ingredient === lot.ingredient ? Math.min(lot.qty, Math.max(0, reported.qty)) : lot.qty;
    usedCost += (lot.qty - left) * lot.unitCost;
    lot.qty = left;
  });
  c.inventory = lotsToday;

  // 2. Consumíveis usados
  let consumablesCost = 0;
  for (const id of CONSUMABLE_IDS) {
    const left = Math.max(0, Math.min(c.consumables[id], result.consumables[id] ?? c.consumables[id]));
    consumablesCost += (c.consumables[id] - left) * CONSUMABLES[id].cost;
    c.consumables[id] = left;
  }

  // 3. Validade e caixa térmica: o que vence estraga; os recheios mais caros vão para a caixa (RN-39)
  const expiring = c.inventory.filter((l) => l.expires <= c.calendar && l.qty > 0);
  let coolerRoom = c.owned.coolers * COOLER_CAPACITY;
  const saveable = expiring
    .filter((l) => !l.inCooler && INGREDIENTS[l.ingredient].kind !== 'massa')
    .sort((a, b) => b.unitCost - a.unitCost);
  const extra: InvLot[] = [];
  for (const lot of saveable) {
    if (coolerRoom <= 0) break;
    const keep = Math.min(lot.qty, coolerRoom);
    coolerRoom -= keep;
    lot.qty -= keep;
    extra.push({ ...lot, qty: keep, expires: c.calendar + 1, inCooler: true });
  }
  let spoiledUnits = 0;
  let spoiledCost = 0;
  let leftoverSale = 0;
  for (const lot of expiring) {
    if (campaign.promo.xepa && INGREDIENTS[lot.ingredient].kind !== 'massa') {
      leftoverSale += lot.qty * lot.unitCost * XEPA_LEFTOVER_VALUE; // sobras vendidas na xepa (RN-125)
    } else {
      spoiledUnits += lot.qty;
      spoiledCost += lot.qty * lot.unitCost;
    }
    lot.qty = 0;
  }
  leftoverSale = round2(leftoverSale);
  c.inventory = [...c.inventory.filter((l) => l.qty > 0), ...extra];

  // 4. Desperdício e bônus de aproveitamento (RN-37, PA-04, PA-05)
  const burnedUnits = result.waste.burned;
  const leftoverUnits = result.waste.leftover;
  const discarded = spoiledUnits + burnedUnits + leftoverUnits;
  const wastePercent = campaign.boughtToday > 0 ? discarded / campaign.boughtToday : discarded > 0 ? 1 : 0;
  const revenue = clampMoney(result.revenue.total);
  const bonus = result.orders.noStock === 0 ? round2(revenue * Math.max(0, BONUS_WASTE_LIMIT - wastePercent)) : 0;

  lines.push({ id: 'receita', label: 'Vendas', amount: round2(revenue) });
  lines.push({ id: 'insumos', label: 'Insumos usados', amount: -round2(usedCost) });
  lines.push({ id: 'estragados', label: 'Insumos estragados', amount: -round2(spoiledCost) });
  if (leftoverSale > 0) lines.push({ id: 'xepa', label: 'Sobras vendidas na xepa', amount: leftoverSale });
  lines.push({ id: 'consumiveis', label: 'Copos e saquinhos', amount: -round2(consumablesCost) });
  lines.push({ id: 'oleo', label: 'Troca de óleo', amount: -round2(clampMoney(result.costs.oil)) });
  const rent = dailySpaceFee(campaign);
  if (rent > 0) lines.push({ id: 'espaco', label: 'Taxa de espaço', amount: -rent });
  const wages = payroll(campaign);
  if (wages > 0) lines.push({ id: 'salarios', label: 'Salários', amount: -wages });
  if (bonus > 0) lines.push({ id: 'bonus', label: 'Bônus de aproveitamento', amount: bonus });
  const fines = clampMoney(result.costs.fines);
  if (fines > 0) lines.push({ id: 'multas', label: 'Multas de encomenda', amount: -round2(fines) });

  // 5. Caixa: compras já saíram no Preparo. Entram vendas e bônus; saem óleo e custos fixos.
  const cashIn = revenue + bonus + leftoverSale - clampMoney(result.costs.oil) - rent - wages - fines;
  c.cash = round2(c.cash + cashIn);

  // 6. Reputação (RN-62)
  const reputationBefore = campaign.reputation;
  const change = result.reputation.change > 0 && campaign.theme === 'tradicional' ? result.reputation.change * THEME_REPUTATION_BONUS : result.reputation.change;
  c.reputation = Math.max(1, Math.min(5, round2(reputationBefore + change)));

  // 6b. Desafios da Associação: progresso, prêmio na conclusão e expiração sem penalidade (RN-135)
  const prizes: { id: string; name: string; prize: number }[] = [];
  const after: Campaign = { ...c, reputation: c.reputation };
  c.challenges = c.challenges.flatMap((ch) => {
    const def = challengeById(ch.id);
    if (!def) return [];
    const r = def.evaluate({ after, result, waste: wastePercent, progress: ch.progress });
    if (r.done) {
      prizes.push({ id: def.id, name: def.name, prize: def.prize });
      return [];
    }
    return campaign.calendar >= ch.deadline ? [] : [{ ...ch, progress: r.progress }];
  });
  for (const p of prizes) lines.push({ id: `desafio-${p.id}`, label: `Prêmio: ${p.name}`, amount: p.prize });
  const prizeCash = prizes.reduce((n, p) => n + p.prize, 0);
  c.cash = round2(c.cash + prizeCash);
  const profit = round2(lines.reduce((n, l) => n + l.amount, 0));

  // 7. Meta (RN-50, RN-54)
  const goal = campaign.freeMode ? null : profitGoal(campaign.day);
  const minRep = campaign.freeMode ? null : minReputation(campaign.day);
  const profitMet = goal === null || profit >= goal;
  const reputationMet = minRep === null || c.reputation >= minRep;
  const met = campaign.freeMode || (profitMet && reputationMet);
  let freeModeStarted = false;
  if (met) {
    if (!campaign.freeMode && campaign.day >= CAMPAIGN_DAYS) {
      c.freeMode = true;
      freeModeStarted = true;
    }
    c.day = campaign.day + 1;
  }

  // 8. Calendário, fadiga e histórico
  c.fatigue = advanceFatigue(campaign);
  c.calendar = campaign.calendar + 1;
  c.boughtToday = 0;
  c.resumes = 0;
  c.claim = null; // a reivindicação vale só para o dia em que foi respondida
  c.hiredToday = [];
  c.orders = []; // as encomendas valem só para o dia
  for (const w of c.staff) w.trainedToday = false;
  c.history = [
    ...c.history,
    {
      day: campaign.day,
      calendar: campaign.calendar,
      revenue: round2(revenue),
      profit,
      reputation: c.reputation,
      met,
      served: result.orders.served,
      lost: result.orders.lostPatience + result.orders.queueFull + result.orders.lostPrice + result.orders.noStock,
      wasteUnits: discarded,
    },
  ].slice(-HISTORY_MAX);

  // 9. Eventos do dia seguinte: reivindicação ou evento previsto (no máximo 1 previsto, RN-150)
  if (rollClaim({ ...c, calendar: c.calendar }, result)) c.claim = 'pendente';
  c.forecast = c.claim === 'pendente' ? null : rollForecast(c);
  if (result.counters.inspection === 'failed') {
    if (result.counters.annulled) c.lastAnnul = campaign.calendar; // o Despachante anula a multa e a perda de reputação
    else c.reputation = Math.max(1, round2(c.reputation - SURPRISE.repPenalty));
  }

  const balance: Balance = {
    lines,
    profit,
    goal,
    minReputation: minRep,
    profitMet,
    reputationMet,
    met,
    reputationBefore,
    reputationAfter: c.reputation,
    spoiledUnits,
    burnedUnits,
    leftoverUnits,
    giftCost: result.giftCost,
    wastePercent,
    bonus,
    fines,
    prizes,
    bankrupt: c.cash < 0,
    newDay: c.day,
    freeModeStarted,
  };
  return { campaign: c, balance };
}
