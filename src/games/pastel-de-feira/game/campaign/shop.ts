import { INGREDIENTS } from '../data/catalog';
import { OFFICE } from '../data/office';
import { COOLER, DELIVERY, EQUIPMENT, EQUIP_IDS, MENU_BOARDS, SPACE, TABLE, TACHO } from '../data/equipment';
import { REST_AREA } from '../data/staff';
import { BASE_RECIPE_IDS, BASE_RECIPES, ITEMS, UPGRADES, itemId } from '../data/recipes';
import {
  buyBasket, buyCooler, buyDeliveryArea, buyOffice, buyDrink, buyRestArea, buyRestSlot, buyTable, buyEquipment, buyMenuBoard, buyRecipe, buySpace, buyTachoExtra, buyTachoUpgrade, buyVersion, nextBasketTacho,
} from './actions/upgrades';
import { totalM2 } from './campaign';
import type { ActionResult, Campaign, Refusal } from './types';

export type ShopSection = 'receitas' | 'bebidas' | 'equipamentos' | 'espaco' | 'cardapio';

export interface Offer {
  id: string;
  section: ShopSection;
  name: string;
  desc: string;
  price: number;
  /** Tenta a compra. A UI nunca repete a regra: o motivo vem daqui. */
  buy: (c: Campaign) => ActionResult;
  /** Dia mínimo, quando há (mostra "a partir do dia N"). */
  minDay?: number;
}

/** Ofertas de compra do jogo, na ordem em que a aba as mostra. */
export function offers(c: Campaign): Offer[] {
  const out: Offer[] = [];
  // dia mínimo da oferta (some com "liberar melhorias", RN-55a)
  const gate = (day: number): number | undefined => (day > 1 && !c.settings.unlockAll ? day : undefined);
  const fromDay = (day: number): string => (gate(day) ? ` A partir do dia ${day}.` : '');
  for (const base of BASE_RECIPE_IDS) {
    const r = BASE_RECIPES[base];
    if (!c.owned.items.includes(base)) {
      out.push({ id: base, section: 'receitas', name: r.name, desc: `Pastel ${r.category}, referência R$ ${r.reference.toFixed(2).replace('.', ',')}`, price: r.unlock.price, minDay: gate(r.unlock.day), buy: (x) => buyRecipe(x, base) });
    }
    if (!c.owned.items.includes(base)) continue;
    for (const up of UPGRADES[base] ?? []) {
      const id = itemId(base, up.level);
      if (c.owned.items.includes(id)) continue;
      const v = ITEMS[id];
      out.push({ id, section: 'receitas', name: `${r.name}: ${v.name.split(' ').pop()}`, desc: `Versão ${up.level}: ${v.filling.map((f) => INGREDIENTS[f].name.toLowerCase()).join(', ')}. Referência +${Math.round(up.refBonus * 100)}%`, price: up.price, buy: (x) => buyVersion(x, id) });
      break; // só a próxima da sequência
    }
  }
  for (const id of Object.keys(ITEMS)) {
    const it = ITEMS[id];
    if (it.kind === 'bebida' && !c.owned.items.includes(id)) {
      out.push({ id, section: 'bebidas', name: it.name, desc: `Referência R$ ${it.reference.toFixed(2).replace('.', ',')}`, price: it.unlock.price, buy: (x) => buyDrink(x, id) });
    }
  }
  for (const id of EQUIP_IDS) {
    const e = EQUIPMENT[id];
    if (c.owned.equip.includes(id)) continue;
    if (id === 'conta-parceira' && !c.owned.delivery) continue;
    out.push({ id, section: 'equipamentos', name: e.name, desc: e.desc, price: e.price, minDay: gate(e.minDay), buy: (x) => buyEquipment(x, id) });
  }
  const basketTacho = nextBasketTacho(c);
  if (basketTacho >= 0) {
    const t = c.owned.tachos[basketTacho];
    out.push({ id: 'cesto', section: 'equipamentos', name: `Cesto extra no tacho ${basketTacho + 1}`, desc: `Mais um cesto para fritar (${t.baskets} → ${t.baskets + 1}). Os tachos enchem em ordem, até ${TACHO.maxBaskets} cestos cada.`, price: TACHO.basketPrice, buy: buyBasket });
  }
  c.owned.tachos.forEach((t, i) => {
    const n = i + 1;
    if (!t.thermostat) out.push({ id: `termostato${i}`, section: 'equipamentos', name: `Termostato no tacho ${n}`, desc: 'Janela do ponto +50% e queima +3 s.', price: TACHO.thermostatPrice, buy: (x) => buyTachoUpgrade(x, 'termostato', i) });
    if (!t.timer) out.push({ id: `timer${i}`, section: 'equipamentos', name: `Cesto com timer no tacho ${n}`, desc: 'Tira sozinho no meio da janela do ponto (nota 80 + equipamento). Substitui o Fritador (R$ 75/dia). Para na queda de energia.', price: TACHO.timerPrice, buy: (x) => buyTachoUpgrade(x, 'timer', i) });
    if (!t.alarm) out.push({ id: `alarme${i}`, section: 'equipamentos', name: `Alarme no tacho ${n}`, desc: 'Avisa quando entra no ponto e 1 s antes de queimar.', price: TACHO.alarmPrice, buy: (x) => buyTachoUpgrade(x, 'alarme', i) });
  });
  if (c.owned.tachos.length < TACHO.max) out.push({ id: 'tacho-extra', section: 'espaco', name: 'Tacho extra', desc: `Ocupa ${TACHO.extraSpace} m². Máximo ${TACHO.max} tachos.`, price: TACHO.extraPrice, buy: buyTachoExtra });
  if (c.owned.coolers < COOLER.max) out.push({ id: 'caixa-termica', section: 'espaco', name: 'Caixa térmica', desc: `Ocupa ${COOLER.space} m². +80 de estoque; recheios duram +1 dia.`, price: COOLER.price, buy: buyCooler });
  if (!c.owned.delivery) out.push({ id: 'delivery', section: 'espaco', name: 'Área de delivery', desc: `Ocupa ${DELIVERY.space} m². Comandas do app, motoboys e Expedição.${fromDay(DELIVERY.minDay)}`, price: DELIVERY.price, minDay: gate(DELIVERY.minDay), buy: buyDeliveryArea });
  if (!c.owned.office) out.push({ id: 'escritorio', section: 'espaco', name: 'Escritório', desc: `Ocupa ${OFFICE.space} m², 3 vagas de cargo. Com você lá, a equipe fica 15% mais rápida.${fromDay(OFFICE.minDay)}`, price: OFFICE.price, minDay: gate(OFFICE.minDay), buy: buyOffice });
  if (c.owned.tables < TABLE.max) out.push({ id: 'mesa', section: 'espaco', name: `Mesa ${c.owned.tables + 1}`, desc: `4 lugares, ocupa ${TABLE.space} m². Clientes de mesa pagam +15% e esperam mais.`, price: TABLE.price, buy: buyTable });
  if (c.owned.rest === 0) out.push({ id: 'descanso', section: 'espaco', name: 'Área de descanso', desc: `Ocupa ${REST_AREA.space} m², ${REST_AREA.firstSlots} vagas. Recupera 4 de energia por segundo.`, price: REST_AREA.price, buy: buyRestArea });
  else if (c.owned.rest < REST_AREA.maxSlots) out.push({ id: 'vaga-descanso', section: 'espaco', name: `Vaga de descanso (${c.owned.rest + 1}ª)`, desc: 'Mais um funcionário descansa na área ao mesmo tempo.', price: REST_AREA.slotPrice, buy: buyRestSlot });
  if (totalM2(c) < SPACE.max) {
    out.push({ id: 'm2', section: 'espaco', name: 'Mais 1 m²', desc: `Taxa de R$ ${SPACE.dailyFee} por dia. Total ${totalM2(c)} de ${SPACE.max} m².`, price: SPACE.price, buy: (x) => buySpace(x, 1) });
  }
  if (c.owned.slotsSalgado < MENU_BOARDS.salgado.last) {
    out.push({ id: 'placa-salgado', section: 'cardapio', name: `Placa de ${c.owned.slotsSalgado + 1} salgados`, desc: 'Mais uma vaga de salgado no cardápio.', price: MENU_BOARDS.salgado.prices[c.owned.slotsSalgado - MENU_BOARDS.salgado.first], buy: (x) => buyMenuBoard(x, 'salgado') });
  }
  if (c.owned.slotsDoce < MENU_BOARDS.doce.last) {
    out.push({ id: 'placa-doce', section: 'cardapio', name: `Placa de ${c.owned.slotsDoce + 1} doces`, desc: 'Mais uma vaga de doce no cardápio.', price: MENU_BOARDS.doce.prices[c.owned.slotsDoce - MENU_BOARDS.doce.first], buy: (x) => buyMenuBoard(x, 'doce') });
  }
  return out;
}

/** Texto do motivo de bloqueio de uma oferta, ou null se dá para comprar agora. */
export function blockReason(c: Campaign, o: Offer): { motivo: Refusal; text: string } | null {
  const r = o.buy(c);
  if (r.ok) return null;
  const text: Record<Refusal, string> = {
    semCaixa: 'Caixa insuficiente',
    semCapacidade: 'Sem espaço no estoque',
    limite: 'Limite atingido',
    bloqueadoAteDia: o.minDay ? `A partir do dia ${o.minDay}` : 'Ainda não disponível',
    requer: 'Requer outro item antes',
    semEspaco: 'Sem m² livres: compre espaço',
  };
  return { motivo: r.motivo, text: text[r.motivo] };
}
