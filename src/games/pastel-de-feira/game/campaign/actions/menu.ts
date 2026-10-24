import { ITEMS, type ItemId } from '../../data/recipes';
import { cloneCampaign } from '../campaign';
import { clampPrice } from '../pricing';
import { THEME_CHANGE_COST, THEME_MIN_DAY, XEPA_DISCOUNTS, BRINDE_MAX_N, BRINDE_MIN_N, CHORINHO_MAX } from '../../constants';
import type { ActionResult, Campaign, Promo, Theme } from '../types';
import { round2 } from '../campaign';

/** Coloca ou tira um item do cardápio do dia (RN-30b). Bebidas não ocupam vaga. */
export function toggleMenuItem(c: Campaign, item: ItemId, on: boolean): ActionResult {
  const it = ITEMS[item];
  if (!it || !c.owned.items.includes(item)) return { ok: false, motivo: 'requer' };
  const list = it.kind === 'salgado' ? c.menu.salgados : it.kind === 'doce' ? c.menu.doces : c.menu.bebidas;
  const has = list.includes(item);
  if (on === has) return { ok: true, campaign: c };
  const slots = it.kind === 'salgado' ? c.owned.slotsSalgado : it.kind === 'doce' ? c.owned.slotsDoce : Infinity;
  if (on && list.length >= slots) return { ok: false, motivo: 'limite' };
  const next = cloneCampaign(c);
  const target = it.kind === 'salgado' ? next.menu.salgados : it.kind === 'doce' ? next.menu.doces : next.menu.bebidas;
  if (on) target.push(item);
  else target.splice(target.indexOf(item), 1);
  return { ok: true, campaign: next };
}

/** Preço de venda do item, limitado à faixa e ao passo (RN-10). */
export function setPrice(c: Campaign, item: ItemId, price: number): ActionResult {
  if (!ITEMS[item] || !c.owned.items.includes(item)) return { ok: false, motivo: 'requer' };
  const next = cloneCampaign(c);
  next.prices[item] = clampPrice(item, price);
  return { ok: true, campaign: next };
}

/** Opções do dia do delivery: ligar/desligar e aceite automático (RN-90, RN-95). Sempre válidas. */
export function setDelivery(c: Campaign, opts: { on?: boolean; auto?: boolean }): Campaign {
  const next = cloneCampaign(c);
  if (opts.on !== undefined) next.deliveryOn = opts.on;
  if (opts.auto !== undefined) next.autoAccept = opts.auto;
  return next;
}

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));

/** Promoções do dia dentro das faixas da spec: sem valor inválido possível (RN-120, RN-123, RN-124). */
export function setPromo(c: Campaign, patch: Partial<Promo>): Campaign {
  const next = cloneCampaign(c);
  const p = next.promo;
  if (patch.brindeN !== undefined) p.brindeN = patch.brindeN <= 0 ? 0 : clampInt(patch.brindeN, BRINDE_MIN_N, BRINDE_MAX_N);
  if (patch.chorinho !== undefined) p.chorinho = clampInt(patch.chorinho, 0, CHORINHO_MAX);
  if (patch.xepa !== undefined) p.xepa = patch.xepa;
  if (patch.xepaDiscount !== undefined) {
    const d = patch.xepaDiscount;
    p.xepaDiscount = XEPA_DISCOUNTS.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), XEPA_DISCOUNTS[0]);
  }
  return next;
}

/** Tema da barraca (RN-17): escolha a partir do dia 5; trocar depois custa R$ 500. */
export function chooseTheme(c: Campaign, theme: Theme): ActionResult {
  if (c.day < THEME_MIN_DAY) return { ok: false, motivo: 'bloqueadoAteDia' };
  if (c.theme === theme) return { ok: false, motivo: 'limite' };
  const cost = c.theme === null ? 0 : THEME_CHANGE_COST;
  if (cost > c.cash + 1e-9) return { ok: false, motivo: 'semCaixa' };
  const next = cloneCampaign(c);
  next.cash = round2(next.cash - cost);
  next.theme = theme;
  return { ok: true, campaign: next };
}
