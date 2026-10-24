import { HOLD_MILL_MANUAL } from '../../constants';
import { MILL_MOTOR_SECONDS } from '../../data/equipment';
import { itemIngredients, ITEMS, type ItemId } from '../../data/recipes';
import { menuEntry, swapDemand } from '../customers';
import { isAt } from '../pasteleiro';
import { emit, newId, type DayState } from '../state';
import { canMake, consumeIngredient } from '../stock';

const EPS = 1e-9;
const DEFAULT_DRINK: ItemId = 'caldo-puro';

/** Segundos para extrair um caldo: 6 s na moenda manual, 2,5 s na motorizada (RN-42). */
export const millSeconds = (s: DayState): number => (s.config.equipment.mill === 'motorizada' ? MILL_MOTOR_SECONDS : HOLD_MILL_MANUAL);

/** Começa a extrair o caldo segurando a moenda (RN-42). Trocar de bebida zera o progresso. */
export function startMill(s: DayState, item: ItemId = DEFAULT_DRINK): boolean {
  if (!isAt(s, 'moenda')) return false;
  const it = ITEMS[item];
  if (!it || it.kind !== 'bebida' || !menuEntry(s, item)) return false;
  if (!canMake(s, it)) {
    swapDemand(s); // sem cana, complemento ou copo: o caldo sai do cardápio (RN-35, RN-39a)
    return false;
  }
  if (s.mill.item !== item) s.mill.progress = 0;
  s.mill.item = item;
  s.pasteleiro.hold = { action: 'moenda', station: 'moenda', item };
  return true;
}

/** Soltar mantém o progresso parcial (a hold sai, o progresso fica). */
export function stopMill(s: DayState): void {
  if (s.pasteleiro.hold?.action === 'moenda') s.pasteleiro.hold = null;
}

/** Faz um copo de caldo: consome cana, complemento e copo (RN-26, RN-39a). */
export function makeCup(s: DayState, id: ItemId): boolean {
  const item = ITEMS[id];
  if (!item || !canMake(s, item)) return false;
  for (const [ing, need] of itemIngredients(item)) consumeIngredient(s, ing, need);
  s.consumables.copo--;
  const cup = { id: newId(s), item: item.id };
  s.cups.push(cup);
  emit(s, 'caldo_pronto', cup.id);
  return true;
}

/** Avança a extração enquanto o pasteleiro segura a moenda. */
export function updateMill(s: DayState, dt: number): void {
  const hold = s.pasteleiro.hold;
  if (hold?.action !== 'moenda' || !s.mill.item) return;
  s.mill.progress += dt;
  if (s.mill.progress < millSeconds(s) - EPS) return;
  const item = ITEMS[s.mill.item];
  s.mill.progress = 0;
  makeCup(s, item.id);
  if (!canMake(s, item)) {
    s.pasteleiro.hold = null;
    swapDemand(s);
  }
}
