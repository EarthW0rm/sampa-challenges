import { daySeed, newCampaign, toDayConfig, canOpen, profitGoal, minReputation } from '../game/campaign/campaign';
import { closeDay } from '../game/campaign/closing';
import { buyConsumable, buyIngredient } from '../game/campaign/actions/inventory';
import { setDelivery, setPrice, setPromo, toggleMenuItem } from '../game/campaign/actions/menu';
import { hire, rollCandidates } from '../game/campaign/actions/staff';
import { buyDeliveryArea } from '../game/campaign/actions/upgrades';
import { offers } from '../game/campaign/shop';
import { suggestPurchase } from '../game/campaign/suggest';
import { clampPrice } from '../game/campaign/pricing';
import { ITEMS } from '../game/data/recipes';
import { ceilingFor, profileShares } from '../game/sim/customers';
import { PRICE_STEP } from '../game/constants';
import type { ActionResult, Campaign } from '../game/campaign/types';
import { DaySim } from '../game/sim/day';
import { Player, playDay, type PlayerStyle } from './player';

/** Robôs de calibração (plan 5.4): jogam campanhas inteiras pela mesma API do jogador. */
export type BotName = 'solo' | 'armadilha' | 'brinde-max' | 'equilibrado';
export const BOT_NAMES: readonly BotName[] = ['solo', 'armadilha', 'brinde-max', 'equilibrado'];

export interface DayRow {
  day: number;
  profit: number;
  goal: number | null;
  met: boolean;
  repBefore: number;
  repAfter: number;
  minRep: number | null;
  cash: number;
  served: number;
  lostPatience: number;
  lostPrice: number;
  noStock: number;
  burned: number;
  rejected: number;
  staff: number;
  delivery: boolean;
  /** Brinde e chorinho ligados neste dia. */
  promo: boolean;
}

export interface Run {
  bot: BotName;
  seed: number;
  rows: DayRow[];
  bankrupt: boolean;
}

const STYLE: PlayerStyle = { reaction: 12, attentive: true };

const take = (c: Campaign, r: ActionResult): Campaign => (r.ok ? r.campaign : c);

/** Compra a sugestão do jogo; se faltar caixa, reduz as quantidades pela metade até caber. */
export function restock(c: Campaign): Campaign {
  const sug = suggestPurchase(c);
  for (const [ing, qty] of Object.entries(sug.ingredients)) {
    for (let q = qty; q >= 1; q = Math.floor(q / 2)) {
      const r = buyIngredient(c, ing, q);
      if (r.ok) {
        c = r.campaign;
        break;
      }
    }
  }
  for (const [id, qty] of Object.entries(sug.consumables)) {
    if (qty <= 0) continue;
    for (let q = qty; q >= 1; q = Math.floor(q / 2)) {
      const r = buyConsumable(c, id as 'copo', q);
      if (r.ok) {
        c = r.campaign;
        break;
      }
    }
  }
  return c;
}

/** Ordem de compra do robô equilibrado (plan 5.4): tacho → estoque → estufa → mesas → receitas, com funcionário quando a fila perde gente. */
// (sem mesas nem delivery: o jogador automático só atende o balcão)
const SHOP_ORDER = ['alarme0', 'grande0', 'caixa-termica', 'estufa', 'placa-salgado', 'frango', 'calabresa', 'tacho-extra', 'caixa-termica', 'm2', 'especial', 'termostato0', 'estufa-grande'];

/** Põe no cardápio o que couber (preço padrão), sem tirar nada. */
function fillMenu(c: Campaign): Campaign {
  for (const id of c.owned.items) {
    const r = toggleMenuItem(c, id, true);
    if (r.ok) c = r.campaign;
  }
  return c;
}

/** Preço que maximiza a receita esperada por cliente, dado o teto de cada perfil (RN-11, RN-13) e a reputação. */
function optimizePrices(c: Campaign): Campaign {
  const shares = profileShares(c.day, 11, 1, c.theme);
  const menu = [...c.menu.salgados, ...c.menu.doces, ...c.menu.bebidas];
  for (const id of menu) {
    const ref = ITEMS[id].reference;
    let best = c.prices[id];
    let bestValue = -1;
    for (let p = clampPrice(id, 0); p <= clampPrice(id, 1e9); p += PRICE_STEP) {
      let buy = 0;
      for (const prof of ['economico', 'padrao', 'exigente'] as const) if (p <= ceilingFor(prof, c.reputation) * ref + 1e-9) buy += shares[prof];
      const value = p * buy;
      if (value > bestValue) {
        bestValue = value;
        best = p;
      }
    }
    c = take(c, setPrice(c, id, best));
  }
  return c;
}

export function invest(c: Campaign, last?: DayRow, first: readonly string[] = []): Campaign {
  const reserve = 250 + c.day * 15;
  let bought = 0;
  const catalog = offers(c);
  const picked = new Set<string>();
  for (const id of [...first, ...SHOP_ORDER]) {
    if (bought >= 2) break;
    const o = catalog.find((x) => x.id === id && !picked.has(x.id));
    if (!o) continue;
    const r = o.buy(c);
    if (r.ok && r.campaign.cash >= reserve) {
      c = r.campaign;
      picked.add(id);
      bought++;
    }
  }
  // funcionário só quando a fila já perde clientes por paciência (a equipe custa R$ 55–75 por dia)
  if (last && !last.met && last.lostPatience + last.noStock >= 4 && c.cash > 300 && c.staff.length < 1 + Math.floor(c.day / 4)) {
    const kind = c.staff.some((w) => w.kind === 'fritador') ? 'geral' : 'fritador';
    const cand = rollCandidates(c).find((k) => k.kind === kind) ?? rollCandidates(c)[0];
    if (cand) c = take(c, hire(c, cand.id));
  }
  return optimizePrices(fillMenu(c));
}

/** Joga um dia: Preparo do robô, dia na simulação, fechamento. */
export function playOne(bot: BotName, c: Campaign, last?: DayRow): { campaign: Campaign; row: DayRow; bankrupt: boolean } {
  if (bot === 'equilibrado' || bot === 'brinde-max') c = invest(c, last, bot === 'brinde-max' ? ['caixa-termica'] : []); // brinde pede estoque: a caixa térmica vem antes
  else c = optimizePrices(c); // jogar bem inclui regular o preço pela reputação (RN-10)
  c = restock(c);
  if (bot === 'brinde-max' && c.day >= 2 && c.staff.length === 0 && c.owned.coolers > 0 && c.cash > 300) {
    const cand = rollCandidates(c).find((k) => k.kind === 'fritador') ?? rollCandidates(c)[0];
    if (cand) c = take(c, hire(c, cand.id)); // sozinho o pasteleiro não segura o brinde: a equipe vem primeiro
  }
  const promo = bot === 'brinde-max' && c.staff.length > 0 && c.owned.coolers > 0;
  if (promo) c = setPromo(c, { brindeN: 2, chorinho: 3 });
  if (bot === 'armadilha' && c.day >= 5) {
    c = take(c, buyDeliveryArea({ ...c, cash: Math.max(c.cash, 2000) })); // o robô sempre tem caixa para a armadilha
    c = setDelivery(c, { on: true, auto: true });
    if (!c.owned.delivery) c = { ...c, owned: { ...c.owned, delivery: true } };
  }
  const config = toDayConfig(c);
  const sim = new DaySim(config, daySeed(c));
  playDay(sim, new Player(bot === 'armadilha' ? { ...STYLE, acceptOffers: true } : STYLE));
  const result = sim.result()!;
  const before = { day: c.day, rep: c.reputation, staff: c.staff.length, delivery: c.owned.delivery && c.deliveryOn };
  const out = closeDay(c, result);
  const b = out.balance;
  return {
    campaign: out.campaign,
    bankrupt: b.bankrupt,
    row: {
      day: before.day, profit: b.profit, goal: b.goal, met: b.met, repBefore: b.reputationBefore, repAfter: b.reputationAfter,
      minRep: b.minReputation, cash: out.campaign.cash, served: result.orders.served, lostPatience: result.orders.lostPatience,
      lostPrice: result.orders.lostPrice, noStock: result.orders.noStock, burned: result.waste.burned, rejected: sim.state.rejected,
      staff: before.staff, delivery: before.delivery, promo,
    },
  };
}

/** Campanha completa de um robô numa semente. `armadilha` joga até o dia 5; os demais até `days`. */
export function playCampaign(bot: BotName, seed: number, days = 20): Run {
  let c = newCampaign({ profile: 'tradicional', eventsOn: false, tutorial: false, seed });
  const rows: DayRow[] = [];
  const last = bot === 'armadilha' ? 5 : days;
  let bankrupt = false;
  let attempts = 0;
  while (c.day <= last && !c.freeMode && attempts++ < days * 3) {
    if (!canOpen(c)) break;
    const r = playOne(bot, c, rows[rows.length - 1]);
    rows.push(r.row);
    c = r.campaign;
    if (r.bankrupt) {
      bankrupt = true;
      break;
    }
  }
  return { bot, seed, rows, bankrupt };
}

export { profitGoal, minReputation };
