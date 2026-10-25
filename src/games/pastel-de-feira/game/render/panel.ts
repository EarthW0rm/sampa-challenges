import { HOLD_BROOM, HOLD_CLEAN_TABLE, HOLD_OIL_MANUAL, STEP } from '../constants';
import { ITEMS, type ItemId } from '../data/recipes';
import { INGREDIENTS, ingredientLabel } from '../data/catalog';
import { inside, MIN_TARGET, PANEL, stationLabel, type Rect } from '../layout';
import { drawPixelText, textWidth } from '../pixelFont';
import { currentQuality } from '../sim/quality';
import { fryWindow, isChanging, isDirty, isLocked } from '../sim/stations/fryer';
import { millSeconds } from '../sim/stations/cane';
import { warmedCount, warmerCapacity } from '../sim/stations/warmer';
import { now, type DayState } from '../sim/state';
import { stockQty } from '../sim/stock';
import type { Command } from '../types';
import { PANEL_IDLE_SECONDS, type UiState } from '../ui';
import { bar, box, drawArt, drawFlavor, drawNine, itemColor, PAL, pastelCat, shortName, textCenter, type PastelState } from './draw';
import { getAssets, LIB_PX } from '../assets';

/** Controle do painel da estação. `run` roda ao tocar (ou ao começar a segurar); `release`, ao soltar. */
export interface Control {
  rect: Rect;
  label: string;
  sub?: string;
  fill: string;
  bar?: { frac: number; color: string };
  selected?: boolean;
  /** Só apresentação: sprite do ícone em `assets/` (`icones/ctrl_anotar`, `itens/ing_carne`…). */
  icon?: string;
  /** Só apresentação: sabor do pastel do ícone, desenhado como selo no canto (passo 4a da arte). */
  flavor?: ItemId;
  /** Só apresentação: o controle só informa (`run` nunca faz nada); a célula aparece desligada. */
  inert?: boolean;
  run: () => Command[];
  release?: () => Command[];
}

const DRINK_LABEL: Record<string, string> = { 'caldo-puro': 'PURO', 'caldo-limao': 'LIMAO', 'caldo-abacaxi': 'ABACAXI' };

/** Ícone do pastel (ou do copo) no estado dado. */
const itemIcon = (id: ItemId, state: PastelState = 'ponto'): string => {
  const cat = pastelCat(id);
  return cat === 'copo' ? caldoIcon(id) : `itens/pastel_${cat}_${state}`;
};

/** Ícone do caldo pelo sabor (puro, limão ou abacaxi). */
const caldoIcon = (id: ItemId): string => `icones/ctrl_caldo_${id === 'caldo-limao' ? 'limao' : id === 'caldo-abacaxi' ? 'abacaxi' : 'puro'}`;

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
    out.push({ rect: next(), label: 'ANOTAR', sub: String(waiting), fill: PAL.blue, icon: 'icones/ctrl_anotar', run: () => tap('balcao', { k: 'anotar' }) });
    const total = st.coins.reduce((n, c) => n + c.amount, 0);
    out.push({
      rect: next(), label: 'COBRAR', sub: total > 0 ? `R$${total.toFixed(0)}` : '-', fill: PAL.gold, icon: 'icones/ctrl_cobrar',
      run: () => tap('balcao', { k: 'moedas' }),
    });
    if (st.tables.length > 0) {
      out.push({ rect: next(), label: 'PAGAR', sub: `${st.payQueue.length}/4`, fill: PAL.orange, icon: 'icones/ctrl_pagar', run: () => tap('balcao', { k: 'pagar' }) });
    }
    const open = st.bigOrders.filter((o) => o.boxed.length < o.qty);
    if (open.length > 0) {
      const left = open.reduce((n, o) => n + o.qty - o.boxed.length, 0);
      out.push({
        rect: next(), label: 'CAIXA', sub: `FALTAM ${left}`, fill: PAL.gold, icon: 'icones/ctrl_caixa',
        run: () => {
          const sel = ui.selected;
          if (sel?.kind !== 'pastel') return [];
          ui.selected = null;
          return tap('balcao', { k: 'encomenda', id: sel.id }); // guarda o pastel selecionado na caixa da encomenda (RN-104)
        },
      });
    }
    out.push({
      rect: next(), label: 'VASSOURA', sub: `${Math.round(st.dirt)}%`, fill: st.dirt >= 80 ? PAL.red : st.dirt >= 60 ? PAL.orange : PAL.tile, icon: 'icones/ctrl_vassoura',
      bar: { frac: st.pasteleiro.hold?.action === 'limpar' ? st.cleaning.progress / HOLD_BROOM : 0, color: PAL.green },
      run: () => [{ type: 'holdStart', station: 'balcao', action: 'limpar' }],
      release: () => [{ type: 'holdEnd' }],
    });
    for (const r of st.ready.filter((x) => x.reservedFor === undefined).slice(0, 7)) {
      const q = Math.round(currentQuality(r, now(st)));
      const sel = ui.selected?.kind === 'pastel' && ui.selected.id === r.id;
      out.push({
        rect: next(), label: shortName(r.item), sub: `${r.warmed ? 'E ' : ''}${q}`, fill: itemColor(r.item), selected: sel, icon: itemIcon(r.item), flavor: r.item,
        run: () => {
          ui.selected = sel ? null : { kind: 'pastel', id: r.id };
          return [];
        },
      });
    }
    for (const c of st.cups.slice(0, 5)) {
      const sel = ui.selected?.kind === 'copo' && ui.selected.id === c.id;
      out.push({
        rect: next(), label: 'CALDO', sub: shortName(c.item), fill: itemColor(c.item), selected: sel, icon: caldoIcon(c.item),
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
        rect: next(), label: ingredientLabel(ing), sub: String(stockQty(st, ing)),
        fill: inTray > 0 ? PAL.tileHi : PAL.tile, selected: inTray > 0, icon: `itens/ing_${ing}`, run: () => tap('bancada', { k: 'ingrediente', id: ing }),
      });
    }
    k = 8;
    out.push({ rect: next(), label: 'FECHAR', sub: String(st.tray.length), fill: PAL.green, icon: 'icones/ctrl_fechar', run: () => tap('bancada', { k: 'fechar' }) });
    out.push({ rect: next(), label: 'LIMPAR', fill: PAL.red, icon: 'icones/ctrl_limpar', run: () => tap('bancada', { k: 'limpar' }) });
    for (const a of st.assembled.slice(0, pages > 1 ? 5 : 6)) {
      const sel = st.selectedAssembled === a.id;
      out.push({
        rect: next(), label: shortName(a.item), sub: 'MONTADO', fill: itemColor(a.item), selected: sel, icon: itemIcon(a.item, 'cru'), flavor: a.item,
        run: () => tap('bancada', { k: 'montado', id: a.id }),
      });
    }
    if (pages > 1) {
      k = 15;
      out.push({
        rect: next(), label: 'MAIS', sub: `${page + 1}/${pages}`, fill: PAL.gold, icon: 'icones/ctrl_mais',
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
        const state: PastelState | null = f && win ? (f.burned ? 'queimado' : seconds < win.ponto[0] ? 'cru' : seconds <= win.ponto[1] ? 'ponto' : 'passado') : null;
        const blink = tacho.alarm && !!f && !!win && !f.burned && (seconds >= win.ponto[0] && seconds <= win.ponto[1] || seconds >= win.burnAt - 1);
        out.push({
          rect: next(), label: `CESTO ${i + 1}`, sub: f ? (f.burned ? 'QUEIMOU' : shortName(f.item)) : 'LIVRE', fill: PAL.tile,
          selected: blink && Math.floor(ui.clock * 6) % 2 === 0, icon: f && state ? itemIcon(f.item, state) : 'icones/ctrl_cesto', flavor: f && state ? f.item : undefined,
          bar: f && win ? { frac: seconds / win.burnAt, color } : undefined, run: () => tap(station, { k: 'cesto', index: i }),
        });
      });
      k = 8;
      out.push({
        rect: next(2), label: isChanging(tacho) ? 'TROCANDO' : 'TROCAR OLEO', sub: isLocked(tacho) ? 'TRAVADO' : `${Math.round(tacho.dirt * 100)}%`,
        fill: isDirty(tacho) ? PAL.red : PAL.tile, icon: 'icones/ctrl_oleo',
        bar: { frac: isChanging(tacho) ? tacho.changeProgress / HOLD_OIL_MANUAL : tacho.dirt, color: isChanging(tacho) ? PAL.green : PAL.oil },
        run: () => [{ type: 'holdStart', station, action: 'oleo' }],
        release: () => [{ type: 'holdEnd' }],
      });
    }
  } else if (station === 'mesas') {
    const waiting = st.customers.filter((c) => c.place === 'mesa' && c.state === 'aguardando').length;
    out.push({ rect: next(), label: 'ANOTAR', sub: String(waiting), fill: PAL.blue, icon: 'icones/ctrl_anotar', run: () => tap('mesas', { k: 'anotar' }) });
    out.push({
      rect: next(), label: 'LIMPAR', sub: st.tables.some((t) => t.seats.includes('sujo')) ? 'SUJA' : '-', fill: PAL.green, icon: 'icones/ctrl_limpar',
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
        rect: next(), label: shortName(r.item), sub: String(Math.round(currentQuality(r, now(st)))), fill: itemColor(r.item), icon: itemIcon(r.item), flavor: r.item,
        run: () => deliverTo(r.item, { kind: 'pastel', id: r.id }),
      });
    }
    for (const c of st.cups.slice(0, 4)) {
      out.push({ rect: next(), label: 'CALDO', sub: shortName(c.item), fill: itemColor(c.item), icon: caldoIcon(c.item), run: () => deliverTo(c.item, { kind: 'copo', id: c.id }) });
    }
  } else if (station === 'escritorio') {
    out.push({ rect: next(2), label: 'GESTAO', sub: st.config.roles.includes('gerente') ? '+15% +10%' : '+15%', fill: PAL.green, icon: 'icones/ctrl_gestao', inert: true, run: () => [] });
    out.push({ rect: next(), label: 'CARGOS', sub: String(st.config.roles.length), fill: PAL.tile, icon: 'icones/ctrl_cargos', inert: true, run: () => [] });
    for (const o of st.bigOrders.slice(0, 3)) {
      out.push({ rect: next(), label: 'ENCOMENDA', sub: `${o.boxed.length}/${o.qty}`, fill: PAL.gold, icon: 'icones/ctrl_encomenda', bar: { frac: o.boxed.length / o.qty, color: PAL.green }, run: () => [] });
    }
  } else if (station === 'expedicao') {
    out.push({ rect: next(), label: 'COMANDAS', sub: String(st.comandas.length), fill: PAL.blue, icon: 'icones/ctrl_comandas', inert: true, run: () => [] });
    out.push({ rect: next(), label: 'EMBALAGEM', sub: String(st.consumables.embalagem), fill: PAL.tile, icon: 'icones/ctrl_embalagem', inert: true, run: () => [] });
    for (const r of st.ready.filter((x) => x.reservedFor === undefined).slice(0, 6)) {
      out.push({
        rect: next(), label: shortName(r.item), sub: String(Math.round(currentQuality(r, now(st)))), fill: itemColor(r.item), icon: itemIcon(r.item), flavor: r.item,
        run: () => tap('expedicao', { k: 'pronto', id: r.id }),
      });
    }
  } else if (station === 'estufa') {
    out.push({ rect: next(), label: 'ESTUFA', sub: `${warmedCount(st)}/${warmerCapacity(st)}`, fill: PAL.blue, icon: 'icones/ctrl_estufa', inert: true, run: () => [] });
    for (const r of st.ready.filter((x) => !x.warmed).slice(0, 7)) {
      out.push({
        rect: next(), label: shortName(r.item), sub: String(Math.round(currentQuality(r, now(st)))), fill: itemColor(r.item), icon: itemIcon(r.item), flavor: r.item,
        run: () => tap('estufa', { k: 'pronto', id: r.id }),
      });
    }
  } else if (station === 'moenda') {
    const drinks = st.config.menu.filter((m) => ITEMS[m.item].kind === 'bebida').slice(0, 3);
    drinks.forEach((m) => {
      const mine = st.mill.item === m.item;
      out.push({
        rect: next(2), label: DRINK_LABEL[m.item] ?? 'CALDO',
        sub: `CANA ${stockQty(st, 'cana')}`, fill: PAL.green, icon: caldoIcon(m.item),
        bar: { frac: mine ? st.mill.progress / millSeconds(st) : 0, color: PAL.gold },
        run: () => [{ type: 'holdStart', station: 'moenda', action: 'moenda', item: m.item }],
        release: () => [{ type: 'holdEnd' }],
      });
    });
    k = 8;
    out.push({ rect: next(2), label: 'COPOS', sub: String(st.consumables.copo), fill: PAL.tile, icon: 'icones/ctrl_copos', inert: true, run: () => [] });
  }
  return out;
}

export function controlAt(controls: readonly Control[], x: number, y: number): Control | undefined {
  return controls.find((c) => inside(c.rect, x, y));
}

/** Ícone centrado em (cx, cy): 24×24 no tamanho natural; sprites com menos de 20 de largura em 2× (escala inteira). */
function drawIcon(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, flavor?: ItemId): void {
  const img = getAssets()?.art(name);
  if (!img) return;
  const k = img.width / LIB_PX < 20 ? 2 : 1;
  const w = (img.width / LIB_PX) * k;
  const h = (img.height / LIB_PX) * k;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  drawArt(ctx, name, x, y, w, h);
  if (flavor && pastelCat(flavor) !== 'copo') drawFlavor(ctx, flavor, x + w - 9, y - 4); // pastel em 2×, selo em 1×
}

/** Texto da célula: k=2 se couber na largura, senão k=1 (um pouco mais abaixo). */
function cellText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, w: number, color: string): void {
  if (textWidth(text, 2) > w - 6) textCenter(ctx, text, cx, y + 3, color, 1, null);
  else textCenter(ctx, text, cx, y, color, 2, null);
}

const HINT = 'TOQUE FORA PARA RECOLHER';

/** Desenha o painel retrátil (RN-74): moldura de madeira, aba com o título e células de pergaminho. */
export function drawPanel(ctx: CanvasRenderingContext2D, st: DayState, ui: UiState): void {
  if (!ui.panel) return;
  if (!drawNine(ctx, 'ui/moldura', PANEL, 8)) box(ctx, PANEL, PAL.panel, PAL.panelLine);
  const title = stationLabel(ui.panel);
  if (!drawNine(ctx, 'ui/aba', { x: 10, y: PANEL.y - 8, w: textWidth(title, 2) + 16, h: 18 }, 4)) box(ctx, { x: 10, y: PANEL.y - 8, w: textWidth(title, 2) + 16, h: 18 }, PAL.tile, PAL.ink);
  drawPixelText(ctx, title, 18, PANEL.y - 4, PAL.ink, 2, null);
  bar(ctx, PANEL.w - 74, PANEL.y + 8, 64, 8, 1 - ui.idle / PANEL_IDLE_SECONDS, PAL.panelLine);
  const controls = panelControls(st, ui);
  controls.forEach((c, i) => {
    const { x, y, w, h } = c.rect;
    const slot = c.selected ? 'ui/slot_selecionado' : c.inert ? 'ui/slot_desligado' : 'ui/slot_normal';
    if (!drawNine(ctx, slot, c.rect, 4)) box(ctx, c.rect, c.selected ? PAL.tileHi : PAL.tile, c.selected ? PAL.gold : PAL.panelLine);
    ctx.fillStyle = c.fill;
    ctx.fillRect(x + 4, y + 4, w - 8, 3);
    const cx = x + w / 2;
    if (c.icon) drawIcon(ctx, c.icon, cx, y + 22, c.flavor);
    cellText(ctx, c.label, cx, y + 38, w, PAL.ink);
    if (c.sub) cellText(ctx, c.sub, cx, y + 51, w, PAL.ink2);
    if (c.bar) bar(ctx, x + 6, y + h - 9, w - 12, 6, c.bar.frac, c.bar.color);
    if (ui.focus === i && ui.keyboard) {
      ctx.strokeStyle = PAL.ink; // foco do teclado
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  });
  const hw = textWidth(HINT, 1);
  const hint: Rect = { x: PANEL.w - 12 - hw, y: PANEL.y + PANEL.h - 14, w: hw, h: 6 };
  if (!controls.some((c) => hint.x < c.rect.x + c.rect.w && c.rect.x < hint.x + hint.w && hint.y < c.rect.y + c.rect.h && c.rect.y < hint.y + hint.h)) {
    drawPixelText(ctx, HINT, hint.x, hint.y, PAL.ink2, 1, null);
  }
}
