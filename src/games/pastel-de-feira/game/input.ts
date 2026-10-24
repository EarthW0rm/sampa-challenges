import { H, W } from './constants';
import { ALERT_BAND, hitTest, inside, orderStations, PANEL, type Layout } from './layout';
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
    if (hit) {
      const cmds = hit.run();
      const rel = hit.release;
      ui.release = rel ? () => stamp(ui, rel()) : null;
      return stamp(ui, cmds);
    }
    // toque no vazio do painel: recolhe e vale como toque na barraca por baixo (mesas, Expedição…)
    ui.panel = null;
  }

  if (inside(ALERT_BAND, x, y) && state.offers.length > 0) return stamp(ui, [{ type: 'acceptOffer', offerId: state.offers[0].id }]);
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
    ui.focus = 0;
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

/** Estações na ordem da visão geral (as mesmas de 1 a 9 no teclado, RN-174). */
export function keyStations(env: InputEnv): StationId[] {
  return orderStations(env.state.config.stations).slice(0, 9);
}

export type KeyResult = { cmds: Command[]; session?: 'pause' | 'mute' | 'speed' };

/**
 * Teclado do desktop (RN-174). Números vão às estações; setas escolhem o controle do painel;
 * Espaço/Enter ativam o controle em foco; Esc recolhe o painel. P, M e F são de sessão.
 * Só os comandos de jogo passam pela fila da simulação (mesmo caminho do toque).
 */
export function keyDown(env: InputEnv, code: string, repeat: boolean): KeyResult | null {
  const { ui, state } = env;
  if (code === 'KeyP') return repeat ? null : { cmds: [], session: 'pause' };
  if (code === 'KeyM') return repeat ? null : { cmds: [], session: 'mute' };
  if (code === 'KeyF') return repeat ? null : { cmds: [], session: 'speed' };
  if (state.paused) return null;
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (digit) {
    if (repeat) return null;
    const station = keyStations(env)[Number(digit[1]) - 1];
    if (!station) return null;
    ui.keyboard = true;
    ui.focus = 0;
    return { cmds: stamp(ui, goTo(env, station)) };
  }
  if (code === 'Escape') {
    ui.panel = null;
    ui.pending = null;
    return { cmds: [] };
  }
  if (!ui.panel) return null;
  const controls = panelControls(state, ui);
  if (controls.length === 0) return null;
  if (code === 'ArrowRight' || code === 'ArrowLeft') {
    ui.keyboard = true;
    ui.idle = 0;
    ui.focus = (ui.focus + (code === 'ArrowRight' ? 1 : controls.length - 1)) % controls.length;
    return { cmds: [] };
  }
  if (code === 'ArrowDown' || code === 'ArrowUp') {
    ui.keyboard = true;
    ui.idle = 0;
    ui.focus = Math.max(0, Math.min(controls.length - 1, ui.focus + (code === 'ArrowDown' ? 8 : -8)));
    return { cmds: [] };
  }
  if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
    if (repeat || ui.release) return null; // auto-repeat não age em dobro; controle segurado já em curso
    ui.keyboard = true;
    ui.idle = 0;
    const hit = controls[Math.min(ui.focus, controls.length - 1)];
    const cmds = hit.run();
    const rel = hit.release;
    ui.release = rel ? () => stamp(ui, rel()) : null;
    return { cmds: stamp(ui, cmds) };
  }
  return null;
}

/** Soltar Espaço/Enter encerra o controle segurado (mesmo caminho de soltar o dedo). */
export function keyUp(env: InputEnv, code: string): Command[] {
  return code === 'Space' || code === 'Enter' || code === 'NumpadEnter' ? pointerUp(env) : [];
}
