import { ITEMS } from '../data/recipes';
import { ALERT_BAND } from '../layout';
import { isChanging, isDirty, isLocked } from '../sim/stations/fryer';
import type { DayState } from '../sim/state';
import { canMake } from '../sim/stock';
import type { UiState } from '../ui';
import { box, PAL, textCenter } from './draw';

/** Avisos ativos, do mais urgente ao menos (RN-75). Texto curto, sem acento (fonte de pixels). */
export function activeAlerts(st: DayState): string[] {
  const out: string[] = [];
  st.tachos.forEach((t, i) => {
    if (t.baskets.some((b) => b.frying?.burned)) out.push(`TACHO ${i + 1}: QUEIMOU`);
    if (isLocked(t)) out.push(`TACHO ${i + 1} TRAVADO`);
    else if (isDirty(t) && !isChanging(t)) out.push(`OLEO SUJO NO TACHO ${i + 1}`);
  });
  for (const m of st.config.menu) {
    if (!canMake(st, ITEMS[m.item])) out.push(`ACABOU ${ITEMS[m.item].name.toUpperCase()}`);
  }
  return out;
}

/** Faixa de avisos no topo, sempre acima do painel. Alterna os avisos a cada 1,5 s. */
export function drawAlerts(ctx: CanvasRenderingContext2D, st: DayState, ui: UiState): void {
  const list = activeAlerts(st);
  if (list.length === 0) return;
  const text = list[Math.floor(ui.clock / 1.5) % list.length];
  box(ctx, ALERT_BAND, '#7a1f17');
  textCenter(ctx, text, ALERT_BAND.w / 2, 5, PAL.text, 2);
}
