import { RAIL_VISIBLE, TICKET_H, TICKET_MIN_W } from '../constants';
import type { Layout, Rect } from '../layout';
import type { DayState, Ticket, Track } from '../sim/state';
import { openTickets, ticketAccepts, ticketLabel } from '../sim/tickets';
import { drawPixelText, textWidth } from '../pixelFont';
import type { ItemRef } from '../types';
import type { UiState } from '../ui';
import { bar, box, drawArt, drawFlavor, drawNine, drawThree, itemColor, PAL, textCenter } from './draw';

/** Visto (✓) em pixels de 2×2 sobre o selo do item preenchido. */
const CHECK: readonly (readonly [number, number])[] = [[1, 6], [3, 8], [5, 6], [7, 4], [9, 2]];

/** Faixa do trilho de cada estação (RN-181): no balcão, no topo do tampo, acima da faixa do painel. */
export function railRect(layout: Layout, track: Track): Rect | null {
  const z = layout.byId.get(track === 'balcao' ? 'balcao' : 'expedicao');
  if (!z) return null;
  return track === 'balcao' ? { x: z.x + 6, y: z.y + 20, w: z.w - 12, h: TICKET_H + 4 } : { x: z.x + 6, y: z.y + 20, w: z.w - 12, h: TICKET_H + 4 };
}

/** Encomenda: um selo só e a contagem "feitos/total", em vez de um selo por unidade (10 a 40). */
const countText = (t: Ticket): string => `${t.slots.filter((l) => l.filled !== null).length}/${t.slots.length}`;

/** Largura da comanda: um selo de 14 por item (ou selo + contagem na encomenda), o rótulo e o mínimo de toque. */
export const ticketWidth = (t: Ticket): number =>
  Math.max(TICKET_MIN_W, t.kind === 'encomenda' ? 20 + textWidth(countText(t)) : 6 + 14 * t.slots.length, textWidth(ticketLabel(t)) + 6);

export interface RailSpot {
  ticket: Ticket;
  rect: Rect;
}

/** Comandas visíveis no trilho, da mais antiga para a mais nova, e quantas ficaram no "+N". */
export function railSpots(layout: Layout, st: DayState, track: Track): { spots: RailSpot[]; hidden: number; rail: Rect | null } {
  const rail = railRect(layout, track);
  if (!rail) return { spots: [], hidden: 0, rail };
  const all = openTickets(st, track);
  const spots: RailSpot[] = [];
  let x = rail.x + 2;
  for (const t of all) {
    const w = ticketWidth(t);
    const rest = all.length - spots.length - 1;
    const room = rail.x + rail.w - (rest > 0 ? 22 : 0); // guarda lugar para o "+N"
    if (spots.length >= RAIL_VISIBLE || x + w > room) break;
    spots.push({ ticket: t, rect: { x, y: rail.y + 3, w, h: TICKET_H } });
    x += w + 4;
  }
  return { spots, hidden: all.length - spots.length, rail };
}

/** Item do pronto selecionado, se ele ainda existe. */
function selectedItem(st: DayState, sel: ItemRef | null): string | null {
  if (!sel) return null;
  return (sel.kind === 'pastel' ? st.ready.find((r) => r.id === sel.id)?.item : st.cups.find((c) => c.id === sel.id)?.item) ?? null;
}

/** Comandas que aceitam o pronto selecionado (destaque do destino, RN-184). Vazio sem seleção. */
export function destinations(st: DayState, sel: ItemRef | null): Set<number> {
  const item = selectedItem(st, sel);
  const out = new Set<number>();
  if (!item) return out;
  for (const t of st.tickets) if (ticketAccepts(st, t, item)) out.add(t.id);
  return out;
}

/** Comanda sob o ponto (toque, RN-182). */
export function ticketAt(layout: Layout, st: DayState, x: number, y: number): Ticket | null {
  for (const track of ['balcao', 'expedicao'] as const) {
    for (const s of railSpots(layout, st, track).spots) {
      const r = s.rect;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return s.ticket;
    }
  }
  return null;
}

/** Fração da paciência do dono da comanda (1 quando ainda não há dono com paciência). */
function ownerPatience(st: DayState, t: Ticket): number {
  const c = t.owner === null ? undefined : st.customers.find((x) => x.id === t.owner);
  return c ? Math.max(0, c.patience / c.patienceMax) : 1;
}

/** Desenha uma comanda: número, selos com visto e estrela de brinde, e a paciência do dono (RN-181). */
export function drawTicket(ctx: CanvasRenderingContext2D, st: DayState, t: Ticket, r: Rect, mode: 'normal' | 'destaque' | 'apagada'): void {
  if (!drawNine(ctx, 'ui/comanda', r, 3)) box(ctx, r, PAL.paper, PAL.ink);
  if (!drawArt(ctx, 'equip/pregador', Math.round(r.x + r.w / 2 - 2), r.y - 4)) box(ctx, { x: r.x + r.w / 2 - 2, y: r.y - 4, w: 4, h: 6 }, '#b8c1c8', PAL.ink);
  textCenter(ctx, ticketLabel(t), r.x + r.w / 2, r.y + 3, PAL.ink, 1, null);
  if (t.kind === 'encomenda') {
    const item = t.slots[0]?.item;
    const x = Math.round(r.x + (r.w - 16 - textWidth(countText(t))) / 2);
    if (item && !drawFlavor(ctx, item, x, r.y + 9)) box(ctx, { x: x + 1, y: r.y + 10, w: 10, h: 10 }, itemColor(item), PAL.ink);
    drawPixelText(ctx, countText(t), x + 15, r.y + 13, PAL.ink, 1, null);
  }
  const x0 = Math.round(r.x + (r.w - 14 * t.slots.length + 2) / 2);
  if (t.kind !== 'encomenda') t.slots.forEach((slot, i) => {
    const sx = x0 + i * 14;
    const sy = r.y + 9;
    if (!drawFlavor(ctx, slot.item, sx, sy)) box(ctx, { x: sx + 1, y: sy + 1, w: 10, h: 10 }, slot.filled ? '#d9b27a' : itemColor(slot.item), PAL.ink);
    if (slot.filled) {
      ctx.fillStyle = 'rgba(251,246,232,0.6)'; // preenchido: véu claro e um visto
      ctx.fillRect(sx, sy, 12, 12);
      ctx.fillStyle = PAL.green;
      for (const [dx, dy] of CHECK) ctx.fillRect(sx + dx, sy + dy, 2, 2);
    }
    if (slot.gift) {
      ctx.fillStyle = PAL.gold; // brinde: estrela dourada no canto
      ctx.fillRect(sx + 9, sy - 1, 3, 3);
    }
  });
  const p = ownerPatience(st, t);
  bar(ctx, r.x + 3, r.y + r.h - 6, r.w - 6, 4, p, p > 0.4 ? PAL.green : PAL.red);
  if (mode === 'destaque') {
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  } else if (mode === 'apagada') {
    ctx.fillStyle = 'rgba(46,28,18,0.45)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

/** Trilho com as comandas (RN-181) e o destaque do destino do pronto selecionado (RN-184). */
export function drawRail(ctx: CanvasRenderingContext2D, layout: Layout, st: DayState, ui: UiState, track: Track): void {
  const { spots, hidden, rail } = railSpots(layout, st, track);
  if (!rail) return;
  if (!drawThree(ctx, 'equip/trilho', rail.x, rail.y, rail.w)) box(ctx, { x: rail.x, y: rail.y, w: rail.w, h: 6 }, PAL.wood, PAL.woodDark);
  const dest = destinations(st, ui.selected);
  for (const s of spots) drawTicket(ctx, st, s.ticket, s.rect, ui.selected === null ? 'normal' : dest.has(s.ticket.id) ? 'destaque' : 'apagada');
  if (hidden > 0) {
    const last = spots[spots.length - 1]?.rect;
    const x = last ? last.x + last.w + 4 : rail.x + 2;
    box(ctx, { x, y: rail.y + 10, w: 18, h: 12 }, PAL.paper, PAL.ink);
    textCenter(ctx, `+${hidden}`, x + 9, rail.y + 14, PAL.ink, 1, null);
  }
}

/** Placa com o número da comanda sobre o dono (RN-185); `flash` faz piscar (toque na comanda sem seleção). */
export function drawOwnerPlate(ctx: CanvasRenderingContext2D, t: Ticket, cx: number, y: number, flash = false): void {
  const label = ticketLabel(t);
  const w = textWidth(label) + 6;
  const r = { x: Math.round(cx - w / 2), y, w, h: 9 };
  if (!drawNine(ctx, flash ? 'ui/placa_num' : 'ui/placa_num', r, 2)) box(ctx, r, PAL.gold, PAL.ink);
  if (flash) {
    ctx.strokeStyle = PAL.red;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3);
  }
  textCenter(ctx, label, cx, y + 2, PAL.ink, 1, null);
}
