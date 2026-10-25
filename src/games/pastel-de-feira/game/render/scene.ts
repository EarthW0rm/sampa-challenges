import { H, STEP, W } from '../constants';
import { ITEMS } from '../data/recipes';
import { center, coveredByPanel, type Layout, type Zone } from '../layout';
import { drawPixelText } from '../pixelFont';
import { currentQuality } from '../sim/quality';
import { queueOf, xepaActive } from '../sim/customers';
import { hasPower } from '../sim/world';
import { fryWindow, isChanging, isDirty, isLocked } from '../sim/stations/fryer';
import { millSeconds } from '../sim/stations/cane';
import { workerStation } from '../sim/staff';
import { now, type Customer, type DayState } from '../sim/state';
import type { UiState } from '../ui';
import { SCALE } from '../hires';
import { aparenciaDe, type Pose } from '../assets';
import { drawTachoFx } from './fx';
import { bar, box, drawArt, drawCliente, drawEquipe, drawFlavor, drawNine, drawPastel, drawPastelFlavor, drawPlaque, drawThree, itemColor, PAL, PROFILE_COLOR, textCenter } from './draw';

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
      const at = workerStation(st, w);
      const z = at ? layout.byId.get(at) : undefined;
      if (z) {
        const n = Number(w.position.slice(-1));
        // a Troca de óleo fica no canto direito do tacho; a Montagem, lado a lado na bancada
        const dx = w.position === 'trocador' ? z.w - 22 : w.position.startsWith('montagem') ? 22 + (n - 1) * 30 : 22;
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

/** Móvel fixo da zona e seus enfeites (coordenadas relativas à zona). A moenda depende do equipamento: vai no `renderScene`. */
function furniture(ctx: CanvasRenderingContext2D, z: Zone): void {
  switch (z.id) {
    case 'balcao':
      drawThree(ctx, 'moveis/balcao', z.x + 4, z.y + 20, z.w - 8);
      break;
    case 'bancada':
      drawThree(ctx, 'moveis/bancada', z.x + 4, z.y + 20, z.w - 8);
      drawArt(ctx, 'decor/saco_farinha', z.x + 30, z.y + 86);
      drawArt(ctx, 'decor/saco_farinha', z.x + 52, z.y + 88);
      drawArt(ctx, 'decor/rolo', z.x + 10, z.y + 58);
      if (z.w >= 120) drawArt(ctx, 'decor/potes', z.x + z.w - 34, z.y + 26);
      break;
    case 'tacho1':
    case 'tacho2':
    case 'tacho3':
      drawThree(ctx, 'moveis/fogao', z.x + 4, z.y + 18, z.w - 8);
      break;
    case 'estufa':
      drawThree(ctx, 'moveis/estufa', z.x + 4, z.y + 22, z.w - 8);
      break;
    case 'escritorio':
      if (!drawThree(ctx, 'moveis/escrivaninha', z.x + 8, z.y + 26, z.w - 16)) box(ctx, { x: z.x + 8, y: z.y + 26, w: z.w - 16, h: 22 }, '#3a4a6a', PAL.woodDark);
      break;
    case 'descanso':
      drawThree(ctx, 'moveis/banco', z.x + 8, z.y + z.h - 28, z.w - 16);
      drawArt(ctx, 'decor/garrafa_cafe', z.x + z.w - 20, z.y + z.h - 46);
      break;
    default:
      break; // mesas, expedição, caixa e fila: o que aparece é dinâmico
  }
}

/** Camada estática: fundo, móveis e placas das zonas. Só redesenha quando o layout muda. */
export function buildStaticLayer(layout: Layout): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W * SCALE;
  cv.height = H * SCALE;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PAL.ground;
  ctx.fillRect(0, 0, W, H);
  if (!drawArt(ctx, 'cenario/fundo', 0, 0, W, H)) {
    for (let x = 0; x < W; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? '#c8402f' : '#f1e6d0'; // toldo listrado (sem arte)
      ctx.fillRect(x, 22, 32, 6);
    }
    for (const z of layout.zones) box(ctx, z, PAL.tile, PAL.woodDark);
  }
  for (const z of layout.zones) {
    furniture(ctx, z);
    drawPlaque(ctx, z.label, z.x + 4, z.y + 4);
  }
  // espaço livre no fim da fileira do meio: caixotes de cana e de limão
  const mid = layout.zones.filter((z) => z.y > 150 && !coveredByPanel(z));
  const end = Math.max(0, ...mid.map((z) => z.x + z.w));
  if (end < W - 52) {
    drawArt(ctx, 'decor/caixote_cana', W - 46, 250);
    if (end < W - 52 - 44) drawArt(ctx, 'decor/caixote_limao', W - 88, 262);
  }
  return cv;
}

/** Onde as migalhas aparecem na calçada da fila (relativo à zona), na ordem em que surgem. */
const CRUMBS: readonly (readonly [number, number])[] = [
  [140, 102],
  [60, 96],
  [210, 108],
];

/** Visto (✓) em pixels de 2×2 sobre o selo da linha entregue. */
const CHECK: readonly (readonly [number, number])[] = [[1, 6], [3, 8], [5, 6], [7, 4], [9, 2]];

function drawBalloon(ctx: CanvasRenderingContext2D, c: Customer, x: number, y: number): void {
  const w = 14 * c.lines.length + 6;
  const bx = Math.round(x - w / 2);
  if (drawNine(ctx, 'ui/balao', { x: bx, y: y - 22, w, h: 20 }, 3)) drawArt(ctx, 'ui/balao_rabo', Math.round(x) - 3, y - 3);
  else box(ctx, { x: bx, y: y - 22, w, h: 20 }, PAL.paper, PAL.ink);
  if (c.state === 'aguardando') {
    textCenter(ctx, '?', x, y - 18, PAL.ink, 2, null);
  } else {
    c.lines.forEach((l, i) => {
      const sx = bx + 4 + i * 14;
      // o selo mostra o sabor pela forma; sem arte, o quadrado de cor
      if (!drawFlavor(ctx, l.item, sx, y - 18)) box(ctx, { x: sx, y: y - 17, w: 10, h: 10 }, l.delivered ? '#d9b27a' : itemColor(l.item), PAL.ink);
      else if (l.delivered) {
        ctx.fillStyle = 'rgba(251,246,232,0.6)'; // entregue: véu claro e um visto
        ctx.fillRect(sx, y - 18, 12, 12);
        ctx.fillStyle = PAL.green;
        for (const [dx, dy] of CHECK) ctx.fillRect(sx + dx, y - 18 + dy, 2, 2);
      }
      if (l.gift) {
        ctx.fillStyle = PAL.gold; // brinde: estrela dourada no canto
        ctx.fillRect(sx + 9, y - 19, 3, 3);
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
  if (!drawThree(ctx, isDirty(t) ? 'equip/tacho_sujo' : 'equip/tacho', z.x + 4, z.y + 22, z.w - 8)) box(ctx, { x: z.x + 4, y: z.y + 22, w: z.w - 8, h: 58 }, PAL.oil, PAL.ink);
  t.baskets.forEach((b, i) => {
    const x = z.x + 8 + i * (bw + 4);
    const y = z.y + 28;
    const f = b.frying ?? (b.shadow !== null ? t.baskets[b.shadow].frying : null);
    const win = f ? fryWindow(ITEMS[f.item], t) : null;
    const sec = f ? f.ticks * STEP : 0;
    const inPonto = !!f && !!win && !f.burned && sec >= win.ponto[0] && sec <= win.ponto[1];
    const alarmOn = t.alarm && !!f && !!win && !f.burned && (inPonto || sec >= win.burnAt - 1) && Math.floor(ui.clock * 6) % 2 === 0;
    drawBasket(ctx, x, y, bw, 44, alarmOn);
    if (f && win) {
      const pst = f.burned ? 'queimado' : sec < win.ponto[0] ? 'cru' : sec <= win.ponto[1] ? 'ponto' : 'passado';
      // cesto estreito: o selo vai acima do cesto, não sobre o pastel
      if (bw < 18) drawFlavor(ctx, f.item, x + bw / 2 - 6, y - 14);
      if (!drawPastelFlavor(ctx, f.item, pst, x + 2, y + 6, bw - 4, b.shadow !== null ? 12 : 18, bw >= 18)) {
        ctx.fillStyle = f.burned ? '#241a14' : itemColor(f.item);
        ctx.fillRect(x + 3, y + 6, bw - 6, b.shadow !== null ? 8 : 14);
      }
      const color = f.burned ? PAL.red : sec < win.ponto[0] ? PAL.blue : sec <= win.ponto[1] ? PAL.green : PAL.orange;
      bar(ctx, x, y + 48, bw, 6, sec / win.burnAt, color);
    }
  });
  if (t.timer) {
    const on = hasPower(st);
    box(ctx, { x: z.x + z.w - 22, y: z.y + 6, w: 16, h: 14 }, PAL.tile, on ? PAL.green : PAL.red); // cesto com timer: borda verde ligado, vermelha sem energia
    textCenter(ctx, 'T', z.x + z.w - 14, z.y + 9, PAL.ink, 1, null);
  }
  bar(ctx, z.x + 8, z.y + z.h - 22, z.w - 16, 6, isChanging(t) ? 0 : t.dirt, isDirty(t) ? PAL.red : PAL.oil);
  if (isLocked(t)) {
    box(ctx, { x: z.x + z.w / 2 - 16, y: z.y + z.h - 15, w: 32, h: 9 }, PAL.tile);
    textCenter(ctx, 'TRAVADO', z.x + z.w / 2, z.y + z.h - 14, PAL.ink, 1, null);
  }
}

/** Cesto do tacho: grade repetida com contorno e alça; com o alarme piscando, contorno vermelho de 2 px. */
function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alarmOn: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  let tiled = true;
  for (let gy = y; gy < y + h && tiled; gy += 8) for (let gx = x; gx < x + w && tiled; gx += 8) tiled = drawArt(ctx, 'equip/cesto_grade', gx, gy);
  if (!tiled) box(ctx, { x, y, w, h }, PAL.oil);
  ctx.restore();
  drawArt(ctx, 'equip/cesto_alca', x + Math.round((w - 6) / 2), y - 8);
  ctx.strokeStyle = alarmOn ? PAL.red : PAL.ink;
  ctx.lineWidth = alarmOn ? 2 : 1;
  const o = alarmOn ? 1 : 0.5;
  ctx.strokeRect(x + o, y + o, w - 2 * o, h - 2 * o);
}

/** Posição do lugar `seat` da mesa `table` na zona das mesas (2×2 mesas de 4 lugares). */
export function seatSpot(z: Zone, table: number, seat: number): { x: number; y: number } {
  const tx = z.x + 12 + (table % 2) * 146;
  const ty = z.y + 26 + Math.floor(table / 2) * 68;
  return { x: tx + 14 + (seat % 2) * 56, y: ty + (seat < 2 ? 18 : 62) };
}

function drawTables(ctx: CanvasRenderingContext2D, st: DayState, z: Zone, ui: UiState): void {
  st.tables.forEach((t, i) => {
    const tx = z.x + 12 + (i % 2) * 146;
    const ty = z.y + 26 + Math.floor(i / 2) * 68;
    if (!drawArt(ctx, 'equip/mesa', tx + 14, ty + 22)) box(ctx, { x: tx + 14, y: ty + 22, w: 90, h: 22 }, PAL.wood, PAL.woodDark);
    t.seats.forEach((seat, j) => {
      const p = seatSpot(z, i, j);
      if (seat === 'sujo') {
        drawArt(ctx, 'decor/assento', p.x - 6, p.y - 4);
        if (!drawArt(ctx, 'decor/migalhas', p.x - 8, p.y - 6)) box(ctx, { x: p.x - 8, y: p.y - 6, w: 16, h: 6 }, PAL.dirt);
      } else if (seat === 'livre' && !drawArt(ctx, 'decor/assento', p.x - 6, p.y - 4)) {
        box(ctx, { x: p.x - 6, y: p.y - 4, w: 12, h: 4 }, PAL.woodDark);
      }
    });
  });
  const groups = [...st.customers, ...st.eating, ...st.payQueue].filter((c) => c.group && c.place !== 'pagamento');
  for (const c of groups) {
    const g = c.group!;
    g.seats.forEach((seatIdx, j) => {
      const p = seatSpot(z, g.table, seatIdx);
      if (c.place === 'fila') return; // reservado: o grupo está na fila do balcão
      drawCliente(ctx, aparenciaDe(st.seed, c.id, j), c.place === 'comendo' ? (Math.floor(ui.clock * 3) % 2 ? 'comendo_1' : 'comendo_0') : 'sentado', p.x, p.y, { flip: seatIdx % 2 === 1, ribbon: PROFILE_COLOR[g.profiles[j] ?? c.profile] });
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
    if (!drawArt(ctx, c.motoboy !== null ? 'equip/sacola_app_motoboy' : 'equip/sacola_app', x, y)) box(ctx, { x, y, w: 20, h: 28 }, c.motoboy !== null ? PAL.green : PAL.tile, PAL.woodDark);
    bar(ctx, x, y + 32, 20, 4, done / c.items.length, PAL.gold);
    const left = c.pickupAt - now(st);
    if (left > 0) textCenter(ctx, String(Math.ceil(left)), x + 10, y + 8, PAL.ink, 1, null);
  });
  st.motoboys.slice(0, 2).forEach((m, i) => {
    const x = z.x + z.w - 22 - i * 34;
    const y = z.y + z.h - 10;
    drawCliente(ctx, aparenciaDe(st.seed, 100000 + m.id), 'parado', x, y, { flip: true, ribbon: PAL.green });
    bar(ctx, x - 12, y - 44, 24, 4, m.waitLeft / 25, m.waitLeft > 8 ? PAL.green : PAL.red);
  });
}

function drawPayQueue(ctx: CanvasRenderingContext2D, st: DayState, z: Zone): void {
  st.payQueue.forEach((c, i) => {
    const x = z.x + z.w - 16 - i * 34;
    const y = z.y + z.h - 12;
    drawCliente(ctx, aparenciaDe(st.seed, c.id), 'feliz', x, y, { flip: true, ribbon: PAL.gold });
    bar(ctx, x - 12, y - 44, 24, 4, c.timer / 20, c.timer > 6 ? PAL.green : PAL.red);
  });
}

function drawWarmer(ctx: CanvasRenderingContext2D, st: DayState, z: Zone): void {
  const cap = st.config.equipment.warmer;
  const warmed = st.ready.filter((r) => r.warmed);
  for (let i = 0; i < cap; i++) {
    const x = z.x + 10 + (i % 4) * 22;
    const y = z.y + 32 + Math.floor(i / 4) * 18;
    if (warmed[i] && drawPastelFlavor(ctx, warmed[i].item, 'ponto', x, y, 18, 12)) continue;
    ctx.fillStyle = warmed[i] ? itemColor(warmed[i].item) : '#24383e';
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
    drawCliente(ctx, aparenciaDe(st.seed, c.id), c.patience < c.patienceMax * 0.3 ? 'bravo' : 'parado', p.x, p.y, { flip: true, ribbon: PROFILE_COLOR[c.profile] });
    drawBalloon(ctx, c, p.x, p.y - 38);
  });

  // balcão: prontos, copos e moedas
  const bal = layout.byId.get('balcao');
  if (bal) {
    st.ready.slice(0, 10).forEach((r, i) => {
      const q = currentQuality(r, now(st));
      const x = bal.x + 8 + (i % 5) * 28;
      const y = bal.y + 26 + Math.floor(i / 5) * 22;
      if (!drawPastelFlavor(ctx, r.item, q >= 50 ? 'ponto' : 'passado', x, y, 22, 14)) {
        ctx.fillStyle = itemColor(r.item);
        ctx.fillRect(x, y, 22, 14);
      }
      bar(ctx, x, y + 17, 22, 4, q / 100, q >= 50 ? PAL.green : PAL.orange);
      if (ui.selected?.kind === 'pastel' && ui.selected.id === r.id) {
        ctx.strokeStyle = PAL.gold;
        ctx.strokeRect(x - 1.5, y - 1.5, 25, 17);
      }
    });
    st.cups.slice(0, 6).forEach((c, i) => {
      if (drawPastel(ctx, c.item, 'ponto', bal.x + 150 + i * 12, bal.y + 28, 10, 14)) return;
      ctx.fillStyle = itemColor(c.item);
      ctx.fillRect(bal.x + 150 + i * 12, bal.y + 28, 10, 14);
    });
    st.coins.slice(0, 6).forEach((_c, i) => {
      if (drawArt(ctx, 'itens/moeda', bal.x + bal.w - 22 - i * 12, bal.y + 52)) return;
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(bal.x + bal.w - 22 - i * 12, bal.y + 52, 10, 10);
    });
  }

  // bancada
  const ban = layout.byId.get('bancada');
  if (ban) {
    st.tray.forEach((ing, i) => {
      if (drawArt(ctx, 'itens/ing_' + ing, ban.x + 8 + i * 14, ban.y + 28)) return;
      ctx.fillStyle = itemColor(ing);
      ctx.fillRect(ban.x + 8 + i * 14, ban.y + 28, 10, 10);
    });
    st.assembled.slice(0, 6).forEach((a, i) => {
      const x = ban.x + 8 + (i % 4) * 28;
      const y = ban.y + 44 + Math.floor(i / 4) * 18;
      if (drawPastelFlavor(ctx, a.item, 'cru', x, y, 22, 14)) return;
      ctx.fillStyle = itemColor(a.item);
      ctx.fillRect(x, y, 22, 14);
    });
  }

  // tachos
  st.tachos.forEach((_t, i) => {
    const z = layout.byId.get(`tacho${i + 1}` as 'tacho1');
    if (z) {
      drawTacho(ctx, st, ui, z, i);
      drawTachoFx(ctx, st, ui, z, i);
    }
  });

  // mesas, fila de pagamento e sujeira
  const me = layout.byId.get('mesas');
  if (me) drawTables(ctx, st, me, ui);
  if (bal && st.tables.length > 0) drawPayQueue(ctx, st, bal);
  const off = layout.byId.get('escritorio');
  if (off) {
    st.bigOrders.slice(0, 3).forEach((o, i) => {
      const x = off.x + 10 + i * 30;
      if (!drawArt(ctx, o.state === 'espera' ? 'equip/caixa_encomenda_pronta' : 'equip/caixa_encomenda', x, off.y + 60)) {
        box(ctx, { x, y: off.y + 60, w: 26, h: 20 }, o.state === 'espera' ? PAL.green : PAL.wood, PAL.woodDark); // caixa de encomenda
      }
      bar(ctx, x, off.y + 84, 26, 4, o.boxed.length / o.qty, PAL.gold);
    });
  }
  const ex = layout.byId.get('expedicao');
  if (ex) drawDispatch(ctx, st, ex);
  const fila = layout.byId.get('fila');
  if (fila) {
    // migalhas na calçada: 1 a partir de 30 de sujeira, mais 1 a cada 25 pontos
    const crumbs = st.dirt >= 30 ? Math.min(3, 1 + Math.floor((st.dirt - 30) / 25)) : 0;
    for (const [dx, dy] of CRUMBS.slice(0, crumbs)) drawArt(ctx, 'decor/migalhas', fila.x + dx, fila.y + dy);
    bar(ctx, fila.x + 6, fila.y + fila.h - 8, 90, 5, st.dirt / 100, st.dirt >= 80 ? PAL.red : st.dirt >= 60 ? PAL.orange : PAL.dirt);
    drawPixelText(ctx, 'SUJEIRA', fila.x + 100, fila.y + fila.h - 10, PAL.ink2, 1, null);
  }

  // estufa, caixas térmicas e moenda
  const es = layout.byId.get('estufa');
  if (es) drawWarmer(ctx, st, es);
  const cx = layout.byId.get('caixa');
  if (cx) {
    for (let i = 0; i < st.config.coolers; i++) {
      if (!drawArt(ctx, 'equip/caixa_termica', cx.x + 8, cx.y + 26 + i * 44)) box(ctx, { x: cx.x + 8, y: cx.y + 26 + i * 44, w: cx.w - 16, h: 38 }, '#3b6ea5', PAL.woodDark);
    }
  }
  const mo = layout.byId.get('moenda');
  if (mo) {
    const eq = st.config.equipment;
    const mx = mo.x + Math.round((mo.w - 72) / 2);
    drawArt(ctx, 'equip/moenda_' + (eq.autoMill ? 'auto' : eq.mill === 'motorizada' ? 'motor' : 'manual'), mx, mo.y + 22);
    bar(ctx, mo.x + 8, mo.y + mo.h - 22, mo.w - 16, 8, (eq.autoMill ? st.autoMill > 0 ? 1 - st.autoMill / millSeconds(st) : 0 : st.mill.progress / millSeconds(st)), PAL.cane);
    if (eq.autoMill) {
      const a = Math.floor(ui.clock * (st.autoMill > 0 ? 8 : 0)) % 4; // moenda automática girando
      ctx.fillStyle = hasPower(st) ? PAL.gold : PAL.red;
      ctx.fillRect(mx + 56 + a * 3, mo.y + 64, 5, 5);
      textCenter(ctx, 'AUTO', mo.x + mo.w / 2, mo.y + mo.h - 14, PAL.ink, 1, null);
    }
  }
  if (bal && st.config.equipment.cardMachine) {
    const mx = bal.x + bal.w - 34;
    if (!drawArt(ctx, 'equip/maquininha', mx, bal.y + 26)) box(ctx, { x: mx, y: bal.y + 26, w: 12, h: 16 }, PAL.blue, PAL.ink); // maquininha
    if (!hasPower(st)) box(ctx, { x: mx + 8, y: bal.y + 26, w: 4, h: 4 }, PAL.red); // sem energia
  }

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
    if (!drawArt(ctx, 'ui/placa_xepa', 470, 120)) box(ctx, { x: 470, y: 120, w: 120, h: 24 }, PAL.red, PAL.text);
    textCenter(ctx, `XEPA -${Math.round(st.config.promo.xepaDiscount * 100)}%`, 530, 127, PAL.text, 2);
  }

  // equipe
  for (const [id, spot] of workerSpots(layout, st)) {
    const w = st.workers.find((x) => x.id === id)!;
    const pose: Pose = w.task && !w.resting ? (Math.floor(ui.clock * 4 + id) % 2 ? 'andando_1' : 'andando_0') : 'parado';
    drawEquipe(ctx, w.kind === 'fritador' ? 'func_fritador' : 'func_geral', aparenciaDe(st.seed, 200000 + id).cor, pose, spot.x, spot.y);
    bar(ctx, spot.x - 12, spot.y - 44, 24, 4, w.energy / 100, w.energy > 40 ? PAL.green : w.energy > 15 ? PAL.orange : PAL.red);
    if (w.resting) textCenter(ctx, 'ZZ', spot.x, spot.y - 56, PAL.ink2, 1, null);
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
    drawEquipe(ctx, 'pasteleiro', '#d9903f', p.to ? (Math.floor(ui.clock * 6) % 2 ? 'andando_1' : 'andando_0') : 'parado', pos.x, pos.y, { flip });
  }
}
