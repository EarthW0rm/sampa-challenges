import { HOLD_BROOM, HOLD_CLEAN_TABLE, HOLD_OIL_MANUAL, STEP } from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import { INGREDIENTS } from '../data/catalog';
import { inside, MIN_TARGET, PANEL, stationLabel, type Rect } from '../layout';
import { drawPixelText } from '../pixelFont';
import { currentQuality } from '../sim/quality';
import { fryWindow, isChanging, isDirty, isLocked } from '../sim/stations/fryer';
import { millSeconds } from '../sim/stations/cane';
import { warmedCount, warmerCapacity } from '../sim/stations/warmer';
import { now, type DayState } from '../sim/state';
import { stockQty } from '../sim/stock';
import type { Command } from '../types';
import { PANEL_IDLE_SECONDS, type UiState } from '../ui';
import { bar, box, itemColor, PAL, shortName, textCenter } from './draw';

/** Controle do painel da estação. `run` roda ao tocar (ou ao começar a segurar); `release`, ao soltar. */
export interface Control {
  rect: Rect;
  label: string;
  sub?: string;
  fill: string;
  bar?: { frac: number; color: string };
  selected?: boolean;
  run: () => Command[];
  release?: () => Command[];
}

const DRINK_LABEL: Record<string, string> = { 'caldo-puro': 'PURO', 'caldo-limao': 'LIMAO', 'caldo-abacaxi': 'ABACAXI' };

const STEP_X = MIN_TARGET + 6;
const ORIGIN_X = 8;
const ORIGIN_Y = PANEL.y + 26;

/** Célula da grade do painel: 72×72 unidades lógicas no mínimo, 8 colunas × 2 linhas. */
export const cell = (col: number, row: number, span = 1): Rect => ({
  x: ORIGIN_X + col * STEP_X,
  y: ORIGIN_Y + row * STEP_X,
  w: MIN_TARGET + (span - 1) * STEP_X,
  h: MIN_TARGET,
});

const tap = (station: Parameters<typeof stationLabel>[0], slot: Extract<Command, { type: 'tapSlot' }>['slot']): Command[] => [
  { type: 'tapSlot', station, slot },
];

export function panelControls(st: DayState, ui: UiState): Control[] {
  const station = ui.panel;
  if (!station) return [];
  const out: Control[] = [];
  let k = 0;
  const next = (span = 1): Rect => {
    const r = cell(k % 8, Math.floor(k / 8), span);
    k += span;
    return r;
  };

  if (station === 'balcao') {
    const waiting = st.customers.filter((c) => c.state === 'aguardando').length;
    out.push({ rect: next(), label: 'ANOTAR', sub: String(waiting), fill: PAL.blue, run: () => tap('balcao', { k: 'anotar' }) });
    const total = st.coins.reduce((n, c) => n + c.amount, 0);
    out.push({
      rect: next(), label: 'COBRAR', sub: total > 0 ? `R$${total.toFixed(0)}` : '-', fill: PAL.gold,
      run: () => tap('balcao', { k: 'moedas' }),
    });
    if (st.tables.length > 0) {
      out.push({ rect: next(), label: 'PAGAR', sub: `${st.payQueue.length}/4`, fill: PAL.orange, run: () => tap('balcao', { k: 'pagar' }) });
    }
    out.push({
      rect: next(), label: 'VASSOURA', sub: `${Math.round(st.dirt)}%`, fill: st.dirt >= 80 ? PAL.red : st.dirt >= 60 ? PAL.orange : PAL.tile,
      bar: { frac: st.pasteleiro.hold?.action === 'limpar' ? st.cleaning.progress / HOLD_BROOM : 0, color: PAL.green },
      run: () => [{ type: 'holdStart', station: 'balcao', action: 'limpar' }],
      release: () => [{ type: 'holdEnd' }],
    });
    for (const r of st.ready.filter((x) => x.reservedFor === undefined).slice(0, 7)) {
      const q = Math.round(currentQuality(r, now(st)));
      const sel = ui.selected?.kind === 'pastel' && ui.selected.id === r.id;
      out.push({
        rect: next(), label: shortName(r.item), sub: `${r.warmed ? 'E ' : ''}${q}`, fill: itemColor(r.item), selected: sel,
        run: () => {
          ui.selected = sel ? null : { kind: 'pastel', id: r.id };
          return [];
        },
      });
    }
    for (const c of st.cups.slice(0, 5)) {
      const sel = ui.selected?.kind === 'copo' && ui.selected.id === c.id;
      out.push({
        rect: next(), label: 'CALDO', sub: shortName(c.item), fill: itemColor(c.item), selected: sel,
        run: () => {
          ui.selected = sel ? null : { kind: 'copo', id: c.id };
          return [];
        },
      });
    }
  } else if (station === 'bancada') {
    const seen = new Set<string>();
    for (const m of st.config.menu) {
      for (const ing of ITEMS[m.item].filling) if (!INGREDIENTS[ing].kind.match(/cana|complemento/)) seen.add(ing);
    }
    const all = [...seen];
    const pages = Math.max(1, Math.ceil(all.length / 8));
    const page = ui.page % pages;
    for (const ing of all.slice(page * 8, page * 8 + 8)) {
      const inTray = st.tray.filter((x) => x === ing).length;
      out.push({
        rect: next(), label: INGREDIENTS[ing].name.split(' ')[0].slice(0, 8), sub: String(stockQty(st, ing)),
        fill: inTray > 0 ? PAL.tileHi : PAL.tile, selected: inTray > 0, run: () => tap('bancada', { k: 'ingrediente', id: ing }),
      });
    }
    k = 8;
    out.push({ rect: next(), label: 'FECHAR', sub: String(st.tray.length), fill: PAL.green, run: () => tap('bancada', { k: 'fechar' }) });
    out.push({ rect: next(), label: 'LIMPAR', fill: PAL.red, run: () => tap('bancada', { k: 'limpar' }) });
    for (const a of st.assembled.slice(0, pages > 1 ? 5 : 6)) {
      const sel = st.selectedAssembled === a.id;
      out.push({
        rect: next(), label: shortName(a.item), sub: 'MONTADO', fill: itemColor(a.item), selected: sel,
        run: () => tap('bancada', { k: 'montado', id: a.id }),
      });
    }
    if (pages > 1) {
      k = 15;
      out.push({
        rect: next(), label: 'MAIS', sub: `${page + 1}/${pages}`, fill: PAL.gold,
        run: () => {
          ui.page = (page + 1) % pages;
          return [];
        },
      });
    }
  } else if (station.startsWith('tacho')) {
    const tacho = st.tachos[Number(station.slice(5)) - 1];
    if (tacho) {
      tacho.baskets.forEach((b, i) => {
        const f = b.frying ?? (b.shadow !== null ? tacho.baskets[b.shadow].frying : null);
        const it = f ? ITEMS[f.item] : null;
        const win = it ? fryWindow(it, tacho) : null;
        const seconds = f ? f.ticks * STEP : 0;
        const color = !f || !win ? PAL.tile : f.burned ? PAL.red : seconds < win.ponto[0] ? PAL.blue : seconds <= win.ponto[1] ? PAL.green : PAL.orange;
        const blink = tacho.alarm && !!f && !!win && !f.burned && (seconds >= win.ponto[0] && seconds <= win.ponto[1] || seconds >= win.burnAt - 1);
        out.push({
          rect: next(), label: `CESTO ${i + 1}`, sub: f ? (f.burned ? 'QUEIMOU' : shortName(f.item)) : 'LIVRE', fill: PAL.tile,
          selected: blink && Math.floor(ui.clock * 6) % 2 === 0,
          bar: f && win ? { frac: seconds / win.burnAt, color } : undefined, run: () => tap(station, { k: 'cesto', index: i }),
        });
      });
      k = 8;
      out.push({
        rect: next(2), label: isChanging(tacho) ? 'TROCANDO' : 'TROCAR OLEO', sub: isLocked(tacho) ? 'TRAVADO' : `${Math.round(tacho.dirt * 100)}%`,
        fill: isDirty(tacho) ? PAL.red : PAL.tile,
        bar: { frac: isChanging(tacho) ? tacho.changeProgress / HOLD_OIL_MANUAL : tacho.dirt, color: isChanging(tacho) ? PAL.green : PAL.oil },
        run: () => [{ type: 'holdStart', station, action: 'oleo' }],
        release: () => [{ type: 'holdEnd' }],
      });
    }
  } else if (station === 'mesas') {
    const waiting = st.customers.filter((c) => c.place === 'mesa' && c.state === 'aguardando').length;
    out.push({ rect: next(), label: 'ANOTAR', sub: String(waiting), fill: PAL.blue, run: () => tap('mesas', { k: 'anotar' }) });
    out.push({
      rect: next(), label: 'LIMPAR', sub: st.tables.some((t) => t.seats.includes('sujo')) ? 'SUJA' : '-', fill: PAL.green,
      bar: { frac: st.pasteleiro.hold?.action === 'limpar' ? st.cleaning.progress / HOLD_CLEAN_TABLE : 0, color: PAL.gold },
      run: () => [{ type: 'holdStart', station: 'mesas', action: 'limpar' }],
      release: () => [{ type: 'holdEnd' }],
    });
    // entregar na mesa: o item vai para o primeiro grupo anotado que o aceita
    const wants = st.customers.filter((c) => c.place === 'mesa' && c.state === 'anotado');
    const deliverTo = (item: ItemId, ref: { kind: 'pastel' | 'copo'; id: number }): Command[] => {
      const g = wants.find((c) => c.lines.some((l) => l.delivered === null && ITEMS[l.item].base === ITEMS[item].base));
      return g ? [{ type: 'deliver', item: ref, customerId: g.id }] : [];
    };
    for (const r of st.ready.slice(0, 7)) {
      out.push({
        rect: next(), label: shortName(r.item), sub: String(Math.round(currentQuality(r, now(st)))), fill: itemColor(r.item),
        run: () => deliverTo(r.item, { kind: 'pastel', id: r.id }),
      });
    }
    for (const c of st.cups.slice(0, 4)) {
      out.push({ rect: next(), label: 'CALDO', sub: shortName(c.item), fill: itemColor(c.item), run: () => deliverTo(c.item, { kind: 'copo', id: c.id }) });
    }
  } else if (station === 'expedicao') {
    out.push({ rect: next(), label: 'COMANDAS', sub: String(st.comandas.length), fill: PAL.blue, run: () => [] });
    out.push({ rect: next(), label: 'EMBALAGEM', sub: String(st.consumables.embalagem), fill: PAL.tile, run: () => [] });
    for (const r of st.ready.filter((x) => x.reservedFor === undefined).slice(0, 6)) {
      out.push({
        rect: next(), label: shortName(r.item), sub: String(Math.round(currentQuality(r, now(st)))), fill: itemColor(r.item),
        run: () => tap('expedicao', { k: 'pronto', id: r.id }),
      });
    }
  } else if (station === 'estufa') {
    out.push({ rect: next(), label: 'ESTUFA', sub: `${warmedCount(st)}/${warmerCapacity(st)}`, fill: PAL.blue, run: () => [] });
    for (const r of st.ready.filter((x) => !x.warmed).slice(0, 7)) {
      out.push({
        rect: next(), label: shortName(r.item), sub: String(Math.round(currentQuality(r, now(st)))), fill: itemColor(r.item),
        run: () => tap('estufa', { k: 'pronto', id: r.id }),
      });
    }
  } else if (station === 'moenda') {
    const drinks = st.config.menu.filter((m) => ITEMS[m.item].kind === 'bebida').slice(0, 3);
    drinks.forEach((m) => {
      const mine = st.mill.item === m.item;
      out.push({
        rect: next(2), label: DRINK_LABEL[m.item] ?? 'CALDO',
        sub: `CANA ${stockQty(st, 'cana')}`, fill: PAL.green,
        bar: { frac: mine ? st.mill.progress / millSeconds(st) : 0, color: PAL.gold },
        run: () => [{ type: 'holdStart', station: 'moenda', action: 'moenda', item: m.item }],
        release: () => [{ type: 'holdEnd' }],
      });
    });
    k = 8;
    out.push({ rect: next(2), label: 'COPOS', sub: String(st.consumables.copo), fill: PAL.tile, run: () => [] });
  }
  return out;
}

export function controlAt(controls: readonly Control[], x: number, y: number): Control | undefined {
  return controls.find((c) => inside(c.rect, x, y));
}

/** Desenha o painel retrátil (RN-74). */
export function drawPanel(ctx: CanvasRenderingContext2D, st: DayState, ui: UiState): void {
  if (!ui.panel) return;
  box(ctx, PANEL, PAL.panel, PAL.panelLine);
  drawPixelText(ctx, stationLabel(ui.panel), 10, PANEL.y + 7, PAL.gold, 2);
  bar(ctx, PANEL.w - 74, PANEL.y + 8, 64, 8, 1 - ui.idle / PANEL_IDLE_SECONDS, PAL.muted);
  for (const c of panelControls(st, ui)) {
    box(ctx, c.rect, c.selected ? PAL.tileHi : PAL.tile, c.selected ? PAL.gold : PAL.panelLine);
    ctx.fillStyle = c.fill;
    ctx.fillRect(c.rect.x + 4, c.rect.y + 4, c.rect.w - 8, 5);
    const cx = c.rect.x + c.rect.w / 2;
    textCenter(ctx, c.label, cx, c.rect.y + 15, PAL.text, 2);
    if (c.sub) textCenter(ctx, c.sub, cx, c.rect.y + 33, PAL.muted, 2);
    if (c.bar) bar(ctx, c.rect.x + 6, c.rect.y + c.rect.h - 14, c.rect.w - 12, 8, c.bar.frac, c.bar.color);
  }
}
