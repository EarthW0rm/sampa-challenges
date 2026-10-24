import { H, STEP, W } from '../constants';
import { ITEMS } from '../data/recipes';
import { center, type Layout, type Zone } from '../layout';
import { drawPixelText } from '../pixelFont';
import { currentQuality } from '../sim/quality';
import { fryWindow, isChanging, isDirty, isLocked } from '../sim/stations/fryer';
import { millSeconds } from '../sim/stations/cane';
import { now, type Customer, type DayState } from '../sim/state';
import type { UiState } from '../ui';
import { SCALE } from '../hires';
import { bar, box, dog, furOf, itemColor, PAL, PROFILE_COLOR, textCenter } from './draw';

/** Posição do cliente `i` da fila (frente à direita, perto do balcão). */
export function queueSpot(layout: Layout, i: number): { x: number; y: number } {
  const z = layout.byId.get('fila')!;
  return { x: z.x + z.w - 30 - i * 46, y: z.y + z.h - 14 };
}

/** Cliente sob o ponto (alvo de toque de 46×64). */
export function customerAt(layout: Layout, st: DayState, x: number, y: number): Customer | null {
  for (let i = 0; i < st.customers.length; i++) {
    const p = queueSpot(layout, i);
    if (Math.abs(x - p.x) <= 22 && y <= p.y + 4 && y >= p.y - 60) return st.customers[i];
  }
  return null;
}

/** Âncora do pasteleiro numa zona (os pés, na frente da estação). */
function anchor(z: Zone): { x: number; y: number } {
  const c = center(z);
  return { x: c.x, y: z.y + z.h - 8 };
}

/** Camada estática: chão e zonas. Só redesenha quando o layout muda. */
export function buildStaticLayer(layout: Layout): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W * SCALE;
  cv.height = H * SCALE;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PAL.ground;
  ctx.fillRect(0, 0, W, H);
  // toldo listrado
  for (let x = 0; x < W; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? '#c8402f' : '#f1e6d0';
    ctx.fillRect(x, 22, 32, 6);
  }
  for (const z of layout.zones) {
    box(ctx, z, z.id === 'fila' ? '#352c42' : '#4a3a2a', PAL.woodDark);
    drawPixelText(ctx, z.label, z.x + 5, z.y + 5, PAL.muted, 2);
  }
  return cv;
}

function drawBalloon(ctx: CanvasRenderingContext2D, c: Customer, x: number, y: number): void {
  const w = 12 * c.lines.length + 8;
  const bx = Math.round(x - w / 2);
  box(ctx, { x: bx, y: y - 22, w, h: 20 }, '#f4efe2', PAL.shadow);
  if (c.state === 'aguardando') {
    textCenter(ctx, '?', x, y - 18, PAL.shadow, 2);
  } else {
    c.lines.forEach((l, i) => {
      ctx.fillStyle = l.delivered ? PAL.muted : itemColor(l.item);
      ctx.fillRect(bx + 4 + i * 12, y - 18, 9, 9);
    });
  }
  bar(ctx, bx, y - 26, w, 4, c.patience / c.patienceMax, c.patience / c.patienceMax > 0.4 ? PAL.green : PAL.red);
}

function drawTacho(ctx: CanvasRenderingContext2D, st: DayState, ui: UiState, z: Zone, index: number): void {
  const t = st.tachos[index];
  if (!t) return;
  const n = t.baskets.length;
  const bw = Math.min(26, Math.floor((z.w - 12) / n) - 4);
  t.baskets.forEach((b, i) => {
    const x = z.x + 8 + i * (bw + 4);
    const y = z.y + 28;
    const f = b.frying ?? (b.shadow !== null ? t.baskets[b.shadow].frying : null);
    const win = f ? fryWindow(ITEMS[f.item], t) : null;
    const sec = f ? f.ticks * STEP : 0;
    const inPonto = !!f && !!win && !f.burned && sec >= win.ponto[0] && sec <= win.ponto[1];
    const alarmOn = t.alarm && !!f && !!win && !f.burned && (inPonto || sec >= win.burnAt - 1) && Math.floor(ui.clock * 6) % 2 === 0;
    box(ctx, { x, y, w: bw, h: 44 }, alarmOn ? PAL.red : PAL.oil, alarmOn ? PAL.text : PAL.woodDark);
    if (f && win) {
      ctx.fillStyle = f.burned ? '#241a14' : itemColor(f.item);
      ctx.fillRect(x + 3, y + 6, bw - 6, b.shadow !== null ? 8 : 14);
      const color = f.burned ? PAL.red : sec < win.ponto[0] ? PAL.blue : sec <= win.ponto[1] ? PAL.green : PAL.orange;
      bar(ctx, x, y + 48, bw, 6, sec / win.burnAt, color);
    }
  });
  bar(ctx, z.x + 8, z.y + z.h - 22, z.w - 16, 6, isChanging(t) ? 0 : t.dirt, isDirty(t) ? PAL.red : PAL.oil);
  if (isLocked(t)) textCenter(ctx, 'TRAVADO', z.x + z.w / 2, z.y + z.h - 14, PAL.red, 1);
}

function drawWarmer(ctx: CanvasRenderingContext2D, st: DayState, z: Zone): void {
  const cap = st.config.equipment.warmer;
  box(ctx, { x: z.x + 6, y: z.y + 26, w: z.w - 12, h: z.h - 40 }, '#2f4a52', PAL.woodDark);
  const warmed = st.ready.filter((r) => r.warmed);
  for (let i = 0; i < cap; i++) {
    const x = z.x + 10 + (i % 4) * 22;
    const y = z.y + 32 + Math.floor(i / 4) * 18;
    ctx.fillStyle = warmed[i] ? itemColor(warmed[i].item) : '#1b2c31';
    ctx.fillRect(x, y, 18, 12);
  }
}

export function renderScene(ctx: CanvasRenderingContext2D, st: DayState, layout: Layout, ui: UiState, statics: HTMLCanvasElement): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(statics, 0, 0);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  // fila
  st.customers.forEach((c, i) => {
    const p = queueSpot(layout, i);
    dog(ctx, p.x, p.y, furOf(c.id), { flip: true, ribbon: PROFILE_COLOR[c.profile] });
    drawBalloon(ctx, c, p.x, p.y - 38);
  });

  // balcão: prontos, copos e moedas
  const bal = layout.byId.get('balcao');
  if (bal) {
    st.ready.slice(0, 10).forEach((r, i) => {
      const q = currentQuality(r, now(st));
      const x = bal.x + 8 + (i % 5) * 28;
      const y = bal.y + 30 + Math.floor(i / 5) * 30;
      ctx.fillStyle = itemColor(r.item);
      ctx.fillRect(x, y, 22, 14);
      bar(ctx, x, y + 17, 22, 4, q / 100, q >= 50 ? PAL.green : PAL.orange);
      if (ui.selected?.kind === 'pastel' && ui.selected.id === r.id) {
        ctx.strokeStyle = PAL.gold;
        ctx.strokeRect(x - 1.5, y - 1.5, 25, 17);
      }
    });
    st.cups.slice(0, 6).forEach((c, i) => {
      ctx.fillStyle = itemColor(c.item);
      ctx.fillRect(bal.x + 8 + i * 14, bal.y + 94, 10, 14);
    });
    st.coins.slice(0, 6).forEach((_c, i) => {
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(bal.x + bal.w - 22 - i * 12, bal.y + 94, 10, 10);
    });
  }

  // bancada
  const ban = layout.byId.get('bancada');
  if (ban) {
    st.tray.forEach((ing, i) => {
      ctx.fillStyle = itemColor(ing);
      ctx.fillRect(ban.x + 8 + i * 14, ban.y + 30, 10, 10);
    });
    st.assembled.slice(0, 6).forEach((a, i) => {
      ctx.fillStyle = itemColor(a.item);
      ctx.fillRect(ban.x + 8 + (i % 4) * 28, ban.y + 56 + Math.floor(i / 4) * 22, 22, 14);
    });
  }

  // tachos
  st.tachos.forEach((_t, i) => {
    const z = layout.byId.get(`tacho${i + 1}` as 'tacho1');
    if (z) drawTacho(ctx, st, ui, z, i);
  });

  // estufa, caixas térmicas e moenda
  const es = layout.byId.get('estufa');
  if (es) drawWarmer(ctx, st, es);
  const cx = layout.byId.get('caixa');
  if (cx) {
    for (let i = 0; i < st.config.coolers; i++) {
      box(ctx, { x: cx.x + 8, y: cx.y + 26 + i * 44, w: cx.w - 16, h: 38 }, '#3b6ea5', PAL.woodDark);
    }
  }
  const mo = layout.byId.get('moenda');
  if (mo) bar(ctx, mo.x + 8, mo.y + 40, mo.w - 16, 8, st.mill.progress / millSeconds(st), PAL.green);

  // pasteleiro
  const p = st.pasteleiro;
  const from = layout.byId.get(p.at);
  if (from) {
    let pos = anchor(from);
    let flip = false;
    if (p.to) {
      const toZone = layout.byId.get(p.to);
      if (toZone) {
        const a = anchor(toZone);
        const f = p.moveTotal > 0 ? 1 - p.moveLeft / p.moveTotal : 1;
        pos = { x: pos.x + (a.x - pos.x) * f, y: pos.y + (a.y - pos.y) * f };
        flip = a.x < anchor(from).x;
      }
    }
    dog(ctx, pos.x, pos.y, '#c9915a', { hat: '#f4efe2', ribbon: PAL.gold, flip, bob: p.to ? Math.sin(ui.clock * 24) * 1.5 : 0 });
  }
}
