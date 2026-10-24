import { ITEMS, itemIngredients } from '../data/recipes';
import { stockOf } from './campaign';
import type { Campaign } from './types';

export interface OpenWarning {
  /** Nada comprado (ou nenhum item do cardápio dá para fazer): o dia sairia sem vendas. */
  severe: boolean;
  /** Frases curtas, em pt-BR, para o aviso antes de abrir a feira. */
  lines: string[];
}

/** Avisos antes de abrir: insumos que faltam para o cardápio e copos/saquinhos. `null` = pode abrir sem aviso. */
export function openWarning(c: Campaign): OpenWarning | null {
  const lines: string[] = [];
  const total = c.inventory.reduce((n, l) => n + l.qty, 0);
  if (total <= 0) {
    return { severe: true, lines: ['Você não comprou nenhum insumo. Sem insumos não dá para fazer pastéis nem caldo.'] };
  }
  const menu = [...c.menu.salgados, ...c.menu.doces, ...c.menu.bebidas];
  const missing = menu.filter((id) => {
    for (const [ing, need] of itemIngredients(ITEMS[id])) if (stockOf(c, ing) < need) return true;
    return false;
  });
  const sellable = c.menu.salgados.filter((id) => !missing.includes(id));
  if (sellable.length === 0 && c.menu.salgados.length > 0) {
    lines.push('Falta insumo para todos os salgados do cardápio.');
  } else if (missing.length > 0) {
    lines.push(`Falta insumo para: ${missing.map((id) => ITEMS[id].name).join(', ')}.`);
  }
  if (c.consumables.saquinho <= 0 && c.menu.salgados.length > 0) lines.push('Sem saquinhos: o pastel perde nota na entrega.');
  if (c.consumables.copo <= 0 && c.menu.bebidas.length > 0) lines.push('Sem copos: não dá para servir caldo.');
  return lines.length > 0 ? { severe: sellable.length === 0 && c.menu.salgados.length > 0, lines } : null;
}
