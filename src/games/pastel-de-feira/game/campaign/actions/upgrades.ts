import { COOLER, DELIVERY, EQUIPMENT, MENU_BOARDS, SPACE, TABLE, TACHO, type EquipId } from '../../data/equipment';
import { REST_AREA } from '../../data/staff';
import { BASE_RECIPES, ITEMS, UPGRADES, itemId, type ItemId } from '../../data/recipes';
import { cloneCampaign, freeM2, round2, totalM2 } from '../campaign';
import { defaultPrice } from '../pricing';
import type { ActionResult, Campaign } from '../types';

/** Compras de melhorias (RN-30, RN-30a, RN-30b, RN-31, RN-71–73). Sem revenda (PA-07). */

type Refuse = { ok: false; motivo: 'semCaixa' | 'semCapacidade' | 'limite' | 'bloqueadoAteDia' | 'requer' | 'semEspaco' };
const no = (motivo: Refuse['motivo']): Refuse => ({ ok: false, motivo });

/** Cobra o preço (e soma ao gasto estrutural, quando é equipamento, espaço ou estrutura). */
function charge(next: Campaign, price: number, structural: boolean): void {
  next.cash = round2(next.cash - price);
  if (structural) next.owned.spent = round2(next.owned.spent + price);
}

const canPay = (c: Campaign, price: number): boolean => price <= c.cash + 1e-9;

/** Comprar receita base (RN-30): dia mínimo e preço do catálogo. */
export function buyRecipe(c: Campaign, base: string): ActionResult {
  const r = BASE_RECIPES[base];
  if (!r) return no('limite');
  if (c.owned.items.includes(base)) return no('limite');
  if (c.day < r.unlock.day) return no('bloqueadoAteDia');
  if (!canPay(c, r.unlock.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, r.unlock.price, false);
  next.owned.items.push(base);
  next.prices[base] = defaultPrice(base);
  return { ok: true, campaign: next };
}

/** Comprar versão melhorada, em sequência (RN-30a): a 2 exige a 1; todas exigem a receita base. */
export function buyVersion(c: Campaign, id: ItemId): ActionResult {
  const it = ITEMS[id];
  if (!it || it.version === 0 || it.kind === 'bebida') return no('limite');
  if (c.owned.items.includes(id)) return no('limite');
  if (!c.owned.items.includes(it.base)) return no('requer');
  if (it.version === 2 && !c.owned.items.includes(itemId(it.base, 1))) return no('requer');
  const up = UPGRADES[it.base]?.find((u) => u.level === it.version);
  if (!up) return no('limite');
  if (!canPay(c, up.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, up.price, false);
  next.owned.items.push(id);
  next.prices[id] = defaultPrice(id);
  return { ok: true, campaign: next };
}

/** Comprar bebida (RN-31). */
export function buyDrink(c: Campaign, id: ItemId): ActionResult {
  const it = ITEMS[id];
  if (!it || it.kind !== 'bebida') return no('limite');
  if (c.owned.items.includes(id)) return no('limite');
  if (c.day < it.unlock.day) return no('bloqueadoAteDia');
  if (!canPay(c, it.unlock.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, it.unlock.price, false);
  next.owned.items.push(id);
  next.prices[id] = defaultPrice(id);
  return { ok: true, campaign: next };
}

/** Equipamento global (RN-73): único, com dia mínimo e pré-requisitos. */
export function buyEquipment(c: Campaign, id: EquipId): ActionResult {
  const def = EQUIPMENT[id];
  if (!def) return no('limite');
  if (c.owned.equip.includes(id)) return no('limite');
  if (c.day < def.minDay) return no('bloqueadoAteDia');
  if (def.requires.some((r) => !c.owned.equip.includes(r))) return no('requer');
  if (id === 'conta-parceira' && !c.owned.delivery) return no('requer');
  if (!canPay(c, def.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, def.price, true);
  next.owned.equip.push(id);
  if (id === 'oleo-algodao') for (const t of next.owned.tachos) t.oil = 'algodao';
  return { ok: true, campaign: next };
}

/** Tacho extra (RN-73): máximo 3, precisa de 2 m² livres (RN-72). */
export function buyTachoExtra(c: Campaign): ActionResult {
  if (c.owned.tachos.length >= TACHO.max) return no('limite');
  if (freeM2(c) < TACHO.extraSpace) return no('semEspaco');
  if (!canPay(c, TACHO.extraPrice)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, TACHO.extraPrice, true);
  next.owned.tachos.push({
    baskets: 2,
    oil: c.owned.equip.includes('oleo-algodao') ? 'algodao' : 'comum',
    thermostat: false,
    alarm: false,
    timer: false,
  });
  return { ok: true, campaign: next };
}

export type TachoUpgrade = 'grande' | 'termostato' | 'alarme';

/** Melhorias por tacho (RN-73): grande (4 cestos), termostato e alarme. */
export function buyTachoUpgrade(c: Campaign, kind: TachoUpgrade, index: number): ActionResult {
  const t = c.owned.tachos[index];
  if (!t) return no('limite');
  const owned = kind === 'grande' ? t.baskets === 4 : kind === 'termostato' ? t.thermostat : t.alarm;
  if (owned) return no('limite');
  const price = kind === 'grande' ? TACHO.largePrice : kind === 'termostato' ? TACHO.thermostatPrice : TACHO.alarmPrice;
  if (!canPay(c, price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, price, true);
  const nt = next.owned.tachos[index];
  if (kind === 'grande') nt.baskets = 4;
  else if (kind === 'termostato') nt.thermostat = true;
  else nt.alarm = true;
  return { ok: true, campaign: next };
}

/** Caixa térmica (RN-39): R$ 200, 1 m², máximo 2. */
export function buyCooler(c: Campaign): ActionResult {
  if (c.owned.coolers >= COOLER.max) return no('limite');
  if (freeM2(c) < COOLER.space) return no('semEspaco');
  if (!canPay(c, COOLER.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, COOLER.price, true);
  next.owned.coolers++;
  return { ok: true, campaign: next };
}

/** Metros quadrados extras (RN-71): R$ 120 cada, até 24 m² no total. */
export function buySpace(c: Campaign, m2: number): ActionResult {
  if (!Number.isInteger(m2) || m2 < 1) return no('limite');
  if (totalM2(c) + m2 > SPACE.max) return no('limite');
  const price = m2 * SPACE.price;
  if (!canPay(c, price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, price, true);
  next.owned.extraM2 += m2;
  return { ok: true, campaign: next };
}

/** Placa de cardápio maior (RN-30b): salgados 4 a 7 vagas, doces 3. */
export function buyMenuBoard(c: Campaign, kind: 'salgado' | 'doce'): ActionResult {
  const board = MENU_BOARDS[kind];
  const current = kind === 'salgado' ? c.owned.slotsSalgado : c.owned.slotsDoce;
  if (current >= board.last) return no('limite');
  const price = board.prices[current - board.first];
  if (!canPay(c, price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, price, false);
  if (kind === 'salgado') next.owned.slotsSalgado++;
  else next.owned.slotsDoce++;
  return { ok: true, campaign: next };
}

/** Área de descanso (RN-117): R$ 120, 1 m², 2 vagas; cada vaga extra custa R$ 80, até 4. */
export function buyRestArea(c: Campaign): ActionResult {
  if (c.owned.rest > 0) return no('limite');
  if (freeM2(c) < REST_AREA.space) return no('semEspaco');
  if (!canPay(c, REST_AREA.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, REST_AREA.price, true);
  next.owned.rest = REST_AREA.firstSlots;
  return { ok: true, campaign: next };
}

export function buyRestSlot(c: Campaign): ActionResult {
  if (c.owned.rest === 0) return no('requer');
  if (c.owned.rest >= REST_AREA.maxSlots) return no('limite');
  if (!canPay(c, REST_AREA.slotPrice)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, REST_AREA.slotPrice, true);
  next.owned.rest++;
  return { ok: true, campaign: next };
}

/** Mesa com 4 lugares (RN-80): R$ 150, 2 m² livres, máximo 4. */
export function buyTable(c: Campaign): ActionResult {
  if (c.owned.tables >= TABLE.max) return no('limite');
  if (freeM2(c) < TABLE.space) return no('semEspaco');
  if (!canPay(c, TABLE.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, TABLE.price, true);
  next.owned.tables++;
  return { ok: true, campaign: next };
}

/** Área de delivery (RN-90): R$ 600, 3 m², a partir do dia 5. */
export function buyDeliveryArea(c: Campaign): ActionResult {
  if (c.owned.delivery) return no('limite');
  if (c.day < DELIVERY.minDay) return no('bloqueadoAteDia');
  if (freeM2(c) < DELIVERY.space) return no('semEspaco');
  if (!canPay(c, DELIVERY.price)) return no('semCaixa');
  const next = cloneCampaign(c);
  charge(next, DELIVERY.price, true);
  next.owned.delivery = true;
  return { ok: true, campaign: next };
}
