import { H, STEP, W } from '../constants';
import { ITEMS } from '../data/recipes';
import { center, type Layout, type Zone } from '../layout';
import { drawPixelText } from '../pixelFont';
import { currentQuality } from '../sim/quality';
import { queueOf, xepaActive } from '../sim/customers';
import { fryWindow, isChanging, isDirty, isLocked } from '../sim/stations/fryer';
import { millSeconds } from '../sim/stations/cane';
import { homeStation } from '../sim/staff';
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
  const queue = queueOf(st);
  for (let i = 0; i < queue.length; i++) {
    const p = queueSpot(layout, i);
    if (Math.abs(x - p.x) <= 22 && y <= p.y + 4 && y >= p.y - 60) return queue[i];
  }
  return null;
}

/** Onde cada funcionário aparece: na zona da posição, na área de descanso ou ao lado da bancada quando ocioso. */
export function workerSpots(layout: Layout, st: DayState): Map<number, { x: number; y: number }> {
  const spots = new Map<number, { x: number; y: number }>();
  let idle = 0;
  let rest = 0;
  for (const w of st.workers) {
    let spot: { x: number; y: number } | null = null;
    if (w.resting === 'area') {
      const z = layout.byId.get('descanso');
      if (z) spot = { x: z.x + 20 + rest++ * 28, y: z.y + z.h - 10 };
    } else if (w.position) {
      const home = w.position === 'trocador' ? ('tacho1' as const) : homeStation(w.position);
      const z = home ? layout.byId.get(home) : undefined;
      if (z) {
        const n = Number(w.position.slice(-1));
        const dx = w.position === 'trocador' ? z.w - 22 : w.position.startsWith('colocador') ? 22 + (n - 1) * 30 : 22;
        spot = { x: z.x + dx, y: z.y + z.h - 8 };
      }
    }
    if (!spot) {
      const z = layout.byId.get('bancada') ?? layout.byId.get('fila')!;
      spot = { x: z.x + 22 + (idle++ % 4) * 26, y: z.y + z.h - 8 - Math.floor(idle / 5) * 0 };
    }
    spots.set(w.id, spot);
  }
  return spots;
}

/** Funcionário sob o ponto (alvo de 30×48), para mandar descansar com um toque (RN-116). */
export function workerAt(layout: Layout, st: DayState, x: number, y: number): number | null {
  for (const [id, p] of workerSpots(layout, st)) if (Math.abs(x - p.x) <= 15 && y <= p.y + 4 && y >= p.y - 48) return id;
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
      if (l.gift) {
        ctx.fillStyle = PAL.gold; // brinde: estrela dourada no canto
        ctx.fillRect(bx + 10 + i * 12, y - 19, 3, 3);
      }
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

/** Posição do lugar `seat` da mesa `table` na zona das mesas (2×2 mesas de 4 lugares). */
export function seatSpot(z: Zone, table: number, seat: number): { x: number; y: number } {
  const tx = z.x + 12 + (table % 2) * 146;
  const ty = z.y + 26 + Math.floor(table / 2) * 68;
  return { x: tx + 14 + (seat % 2) * 56, y: ty + (seat < 2 ? 18 : 62) };
}

function drawTables(ctx: CanvasRenderingContext2D, st: DayState, z: Zone): void {
  st.tables.forEach((t, i) => {
    const tx = z.x + 12 + (i % 2) * 146;
    const ty = z.y + 26 + Math.floor(i / 2) * 68;
    box(ctx, { x: tx + 14, y: ty + 22, w: 90, h: 22 }, PAL.wood, PAL.woodDark);
    t.seats.forEach((seat, j) => {
      const p = seatSpot(z, i, j);
      if (seat === 'sujo') {
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(p.x - 8, p.y - 6, 16, 6);
      } else if (seat === 'livre') {
        ctx.fillStyle = '#3a2f4a';
        ctx.fillRect(p.x - 6, p.y - 4, 12, 4);
      }
    });
  });
  const groups = [...st.customers, ...st.eating, ...st.payQueue].filter((c) => c.group && c.place !== 'pagamento');
  for (const c of groups) {
    const g = c.group!;
    g.seats.forEach((seatIdx, j) => {
      const p = seatSpot(z, g.table, seatIdx);
      if (c.place === 'fila') return; // reservado: o grupo está na fila do balcão
      dog(ctx, p.x, p.y, furOf(c.id + j * 3), { flip: seatIdx % 2 === 1, ribbon: PROFILE_COLOR[g.profiles[j] ?? c.profile] });
    });
    const first = seatSpot(z, g.table, g.seats[0]);
    if (c.place === 'comendo') bar(ctx, first.x - 10, first.y - 46, 40, 4, 1 - c.timer / 25, PAL.gold);
    else if (c.place === 'mesa') drawBalloon(ctx, c, first.x + 14, first.y - 30);
  }
}

function drawDispatch(ctx: CanvasRenderingContext2D, st: DayState, z: Zone): void {
  st.comandas.slice(0, 4).forEach((c, i) => {
    const x = z.x + 8 + i * 24;
    const y = z.y + 26;
    const done = c.packed.filter((p) => p !== null).length;
    box(ctx, { x, y, w: 20, h: 28 }, c.motoboy !== null ? PAL.green : PAL.tile, PAL.woodDark);
    bar(ctx, x, y + 32, 20, 4, done / c.items.length, PAL.gold);
    const left = c.pickupAt - now(st);
    if (left > 0) textCenter(ctx, String(Math.ceil(left)), x + 10, y + 8, PAL.text, 1);
  });
  st.motoboys.slice(0, 2).forEach((m, i) => {
    const x = z.x + z.w - 22 - i * 34;
    const y = z.y + z.h - 10;
    dog(ctx, x, y, furOf(m.id * 5), { flip: true, hat: PAL.green });
    bar(ctx, x - 12, y - 44, 24, 4, m.waitLeft / 25, m.waitLeft > 8 ? PAL.green : PAL.red);
  });
}

function drawPayQueue(ctx: CanvasRenderingContext2D, st: DayState, z: Zone): void {
  st.payQueue.forEach((c, i) => {
    const x = z.x + z.w - 16 - i * 34;
    const y = z.y + z.h - 12;
    dog(ctx, x, y, furOf(c.id), { flip: true, ribbon: PAL.gold });
    bar(ctx, x - 12, y - 44, 24, 4, c.timer / 20, c.timer > 6 ? PAL.green : PAL.red);
  });
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
  queueOf(st).forEach((c, i) => {
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

  // mesas, fila de pagamento e sujeira
  const me = layout.byId.get('mesas');
  if (me) drawTables(ctx, st, me);
  if (bal && st.tables.length > 0) drawPayQueue(ctx, st, bal);
  const off = layout.byId.get('escritorio');
  if (off) {
    box(ctx, { x: off.x + 8, y: off.y + 26, w: off.w - 16, h: 22 }, '#3a4a6a', PAL.woodDark); // mesa de trabalho
    st.bigOrders.slice(0, 3).forEach((o, i) => {
      const x = off.x + 10 + i * 30;
      box(ctx, { x, y: off.y + 60, w: 26, h: 20 }, o.state === 'espera' ? PAL.green : PAL.wood, PAL.woodDark); // caixa de encomenda
      bar(ctx, x, off.y + 84, 26, 4, o.boxed.length / o.qty, PAL.gold);
    });
  }
  const ex = layout.byId.get('expedicao');
  if (ex) drawDispatch(ctx, st, ex);
  const fila = layout.byId.get('fila');
  if (fila) {
    bar(ctx, fila.x + 6, fila.y + fila.h - 8, 90, 5, st.dirt / 100, st.dirt >= 80 ? PAL.red : st.dirt >= 60 ? PAL.orange : PAL.muted);
    drawPixelText(ctx, 'SUJEIRA', fila.x + 100, fila.y + fila.h - 10, st.dirt >= 60 ? PAL.orange : PAL.muted, 1);
  }

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

  // efeitos de evento: sem cobrir as zonas com cor opaca (RN-75)
  if (st.config.forecast === 'chuva') {
    ctx.fillStyle = 'rgba(120, 170, 255, 0.35)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 53 + Math.floor(ui.clock * 90)) % W;
      const y = (i * 29 + Math.floor(ui.clock * 160)) % 280;
      ctx.fillRect(x, y + 24, 1, 6);
    }
  }
  if (st.world.powerLeft > 0) {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.35)';
    ctx.fillRect(0, 24, W, 276);
  }
  st.tachos.forEach((t, i) => {
    const z = layout.byId.get(`tacho${i + 1}` as 'tacho1');
    if (z && t.fireLeft > 0) {
      ctx.fillStyle = Math.floor(ui.clock * 8) % 2 === 0 ? 'rgba(255, 110, 20, 0.7)' : 'rgba(255, 200, 40, 0.7)';
      ctx.fillRect(z.x + 8, z.y + 24, z.w - 16, 52);
      textCenter(ctx, 'FOGO', z.x + z.w / 2, z.y + 44, PAL.text, 2);
    }
  });
  if (layout.byId.get('mesas') && st.config.forecast === 'subprefeitura') {
    const m = layout.byId.get('mesas')!;
    textCenter(ctx, 'PROIBIDO', m.x + m.w / 2, m.y + 4, PAL.red, 2);
  }

  // placa da xepa às 13h (RN-124)
  if (xepaActive(st)) {
    box(ctx, { x: 470, y: 120, w: 120, h: 24 }, PAL.red, PAL.text);
    textCenter(ctx, `XEPA -${Math.round(st.config.promo.xepaDiscount * 100)}%`, 530, 127, PAL.text, 2);
  }

  // equipe
  for (const [id, spot] of workerSpots(layout, st)) {
    const w = st.workers.find((x) => x.id === id)!;
    dog(ctx, spot.x, spot.y, furOf(id * 7), { hat: w.kind === 'fritador' ? PAL.red : PAL.blue, bob: w.task ? Math.sin(ui.clock * 10 + id) : 0 });
    bar(ctx, spot.x - 12, spot.y - 44, 24, 4, w.energy / 100, w.energy > 40 ? PAL.green : w.energy > 15 ? PAL.orange : PAL.red);
    if (w.resting) textCenter(ctx, 'ZZ', spot.x, spot.y - 56, PAL.muted, 1);
  }

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
