import { STEP } from '../constants';
import { ITEMS } from '../data/recipes';
import { unmetItems } from './demand';
import { makeCup, millSeconds } from './stations/cane';
import { fryWindow, takeBasket } from './stations/fryer';
import { takeCoins } from './stations/counter';
import { chargeGroup } from './stations/tables';
import type { DayState, Tacho } from './state';
import { canMake } from './stock';
import { hasPower } from './world';

const EPS = 1e-9;

/** Cesto com timer ativo neste tacho: tem o equipamento e há energia (RN-152, RN-160). */
export const timerActive = (s: DayState, tacho: Tacho): boolean => tacho.timer && hasPower(s);
export const autoMillActive = (s: DayState): boolean => s.config.equipment.autoMill && hasPower(s);
export const cardMachineActive = (s: DayState): boolean => s.config.equipment.cardMachine && hasPower(s);

/**
 * Executores automáticos (RN-160–162): o timer tira no meio da janela sem traço nem curso, a moenda
 * automática faz um caldo por pedido anotado e a maquininha cobra o balcão e a fila de pagamento.
 * Param na queda de energia.
 */
export function updateAutomation(s: DayState, dt: number): void {
  for (const tacho of s.tachos) {
    if (!timerActive(s, tacho) || tacho.fireLeft > 0) continue;
    for (let i = 0; i < tacho.baskets.length; i++) {
      const f = tacho.baskets[i].frying;
      if (!f || f.burned) continue;
      const win = fryWindow(ITEMS[f.item], tacho);
      const mid = win.ponto[0] + (win.ponto[1] - win.ponto[0]) / 2;
      if (f.ticks * STEP < mid - EPS) continue;
      f.bonus = 0; // traço e curso não valem para o pastel do timer (RN-162); o pastel fica no escorredor
      takeBasket(s, tacho, i, 0);
    }
  }
  if (autoMillActive(s)) {
    if (s.autoMill > 0) {
      s.autoMill -= dt;
      if (s.autoMill <= EPS) {
        s.autoMill = 0;
        const want = unmetItems(s, true).find((id) => canMake(s, ITEMS[id]));
        if (want) makeCup(s, want);
      }
    } else if (unmetItems(s, true).some((id) => canMake(s, ITEMS[id]))) {
      s.autoMill = millSeconds(s); // com o chorinho configurado (RN-160)
    }
  } else s.autoMill = 0;
  if (cardMachineActive(s)) {
    takeCoins(s);
    while (chargeGroup(s)) continue;
  }
}
