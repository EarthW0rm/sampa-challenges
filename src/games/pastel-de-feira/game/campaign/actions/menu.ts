import { ITEMS, type ItemId } from '../../data/recipes';
import { cloneCampaign } from '../campaign';
import { clampPrice } from '../pricing';
import type { ActionResult, Campaign } from '../types';

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
