import type { Zone } from '../layout';
import type { DayState } from '../sim/state';
import type { UiState } from '../ui';

/** Efeitos leves (sem alocação por quadro): vapor do óleo e fumaça do pastel queimado (RN-165, visual). */
export function drawTachoFx(ctx: CanvasRenderingContext2D, st: DayState, ui: UiState, z: Zone, index: number): void {
  const t = st.tachos[index];
  if (!t) return;
  const n = t.baskets.length;
  const bw = Math.min(26, Math.floor((z.w - 12) / n) - 4);
  t.baskets.forEach((b, i) => {
    const f = b.frying;
    if (!f) return;
    const cx = z.x + 8 + i * (bw + 4) + bw / 2;
    for (let k = 0; k < 3; k++) {
      const ph = (ui.clock * (f.burned ? 0.8 : 1.2) + k / 3 + i * 0.21) % 1;
      const y = z.y + 26 - ph * 16;
      ctx.globalAlpha = (1 - ph) * (f.burned ? 0.7 : 0.35);
      ctx.fillStyle = f.burned ? '#4a4552' : '#f4efe2';
      ctx.fillRect(Math.round(cx + Math.sin(ph * 6 + k * 2) * 3), Math.round(y), 3, 3);
    }
    ctx.globalAlpha = 1;
  });
}
