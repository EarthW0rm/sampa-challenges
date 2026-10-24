import { H, W } from './constants';
import { hitTest, inside, PANEL, type Layout } from './layout';
import { controlAt, panelControls } from './render/panel';
import { customerAt, workerAt } from './render/scene';
import type { DayState } from './sim/state';
import type { Command, StationId } from './types';
import { PANEL_IDLE_SECONDS, type UiState } from './ui';

export interface InputEnv {
  state: DayState;
  layout: Layout;
  ui: UiState;
}

/** Coordenadas de tela (px CSS) → lógicas 640×480, recalculadas a cada evento (redimensionamento). */
export function toLogical(canvas: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { x: -1, y: -1 };
  return { x: ((clientX - r.left) * W) / r.width, y: ((clientY - r.top) * H) / r.height };
}

/** Cada comando recebe um id de gesto próprio: o mesmo id é processado uma vez só. */
function stamp(ui: UiState, cmds: Command[]): Command[] {
  return cmds.map((c) => (c.type === 'pause' || c.type === 'resume' || c.type === 'setSpeed' ? c : { ...c, g: ++ui.gesture }));
}

function goTo(env: InputEnv, station: StationId): Command[] {
  const { ui, state } = env;
  ui.pending = station;
  ui.panel = state.pasteleiro.to === null && state.pasteleiro.at === station ? station : null;
  ui.idle = 0;
  return [{ type: 'tapStation', station }];
}

/** Toque ou clique. Devolve os comandos para a simulação (e muda só a UI). */
export function pointerDown(env: InputEnv, x: number, y: number): Command[] {
  const { ui, layout, state } = env;
  ui.idle = 0;

  if (ui.panel && inside(PANEL, x, y)) {
    const hit = controlAt(panelControls(state, ui), x, y);
    if (!hit) return [];
    const cmds = hit.run();
    const rel = hit.release;
    ui.release = rel ? () => stamp(ui, rel()) : null;
    return stamp(ui, cmds);
  }

  const worker = workerAt(layout, state, x, y);
  if (worker !== null) {
    const w = state.workers.find((o) => o.id === worker);
    // Só o fixo descansa por ordem do jogador; o automático descansa sozinho (RN-116)
    return w && w.mode === 'fixo' && !w.resting ? stamp(ui, [{ type: 'sendRest', staffId: w.id }]) : [];
  }
  const zone = hitTest(layout, x, y);
  if (!zone) {
    if (ui.panel) ui.panel = null; // toque fora do painel recolhe
    return [];
  }
  if (zone.id === 'fila') {
    const c = customerAt(layout, state, x, y);
    const atCounter = state.pasteleiro.to === null && state.pasteleiro.at === 'balcao';
    if (c && ui.selected && atCounter) {
      const item = ui.selected;
      ui.selected = null;
      return stamp(ui, [{ type: 'deliver', item, customerId: c.id }]);
    }
    return stamp(ui, goTo(env, 'balcao'));
  }
  if (zone.id === 'caixa') return [];
  return stamp(ui, goTo(env, zone.id));
}

/** Ao soltar o dedo/botão: encerra o controle segurado. */
export function pointerUp(env: InputEnv): Command[] {
  const { ui } = env;
  const cmds = ui.release ? ui.release() : [];
  ui.release = null;
  return cmds;
}

/** Abre o painel quando o pasteleiro chega, recolhe por inatividade e descarta seleção inválida. */
export function syncUi(env: InputEnv, dt: number): void {
  const { ui, state } = env;
  ui.clock += dt;
  const p = state.pasteleiro;
  if (ui.pending && p.to === null && p.at === ui.pending) {
    ui.panel = ui.pending;
    ui.pending = null;
    ui.idle = 0;
  }
  if (ui.panel && (p.to !== null || p.at !== ui.panel)) ui.panel = null;
  if (ui.panel) {
    ui.idle = p.hold ? 0 : ui.idle + dt;
    if (ui.idle >= PANEL_IDLE_SECONDS) ui.panel = null;
  }
  if (ui.selected) {
    const sel = ui.selected;
    const alive = sel.kind === 'pastel' ? state.ready.some((r) => r.id === sel.id) : state.cups.some((c) => c.id === sel.id);
    if (!alive) ui.selected = null;
  }
}
