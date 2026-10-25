import { H, W } from './constants';
import type { StationId } from './types';

/** Zonas fixas da barraca em coordenadas lógicas 640×480 (RN-74, RN-75). Só leitura. */

/** `fila` e `caixa` (caixas térmicas) são zonas sem estação: ninguém se desloca até elas. */
export type ZoneId = StationId | 'fila' | 'caixa';

export interface Zone {
  id: ZoneId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface Layout {
  zones: readonly Zone[];
  byId: ReadonlyMap<ZoneId, Zone>;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Faixa de avisos: sempre visível, acima do painel (RN-75). */
export const ALERT_BAND: Rect = { x: 0, y: 0, w: W, h: 22 };
/** Painel retrátil da estação: ≈ 640×180 sobre a faixa inferior (RN-74). */
export const PANEL: Rect = { x: 0, y: H - 180, w: W, h: 180 };
/** Alvo mínimo de toque no painel, em unidades lógicas (≈ 44 px CSS a 390 px). */
export const MIN_TARGET = 72;

const LABELS: Record<StationId, string> = {
  balcao: 'BALCAO', bancada: 'BANCADA', tacho1: 'TACHO 1', tacho2: 'TACHO 2', tacho3: 'TACHO 3',
  moenda: 'MOENDA', mesas: 'MESAS', expedicao: 'EXPEDICAO', escritorio: 'ESCRITORIO', descanso: 'DESCANSO',
};
export const stationLabel = (id: StationId): string => LABELS[id];

const MID: readonly StationId[] = ['bancada', 'tacho1', 'tacho2', 'tacho3', 'moenda'];
const LOW: readonly StationId[] = ['mesas', 'expedicao', 'escritorio', 'descanso'];

const TOP_Y = 30;
const MID_Y = 158;
const LOW_Y = PANEL.y + 6;
const GAP = 6;

/** Ordem física das estações na barraca: base do deslocamento do pasteleiro (RN-41). */
export const STATION_ORDER: readonly StationId[] = [
  'balcao', 'bancada', 'tacho1', 'tacho2', 'tacho3', 'moenda', 'mesas', 'expedicao', 'escritorio', 'descanso',
];

/** Põe as estações na ordem física. */
export const orderStations = (list: readonly StationId[]): StationId[] => STATION_ORDER.filter((id) => list.includes(id));

/** Grafo de vizinhança (cada estação encosta nas vizinhas da ordem física). Conexo por construção. */
export function neighborGraph(stations: readonly StationId[]): ReadonlyMap<StationId, StationId[]> {
  const g = new Map<StationId, StationId[]>();
  stations.forEach((id, i) => g.set(id, [stations[i - 1], stations[i + 1]].filter((x): x is StationId => x !== undefined)));
  return g;
}

export interface LayoutOptions {
  /** Caixas térmicas compradas (zona ao lado do balcão). */
  coolers?: number;
}

/**
 * Monta as zonas a partir do que foi comprado (slots fixos por tipo: a barraca cheia sempre cabe em
 * 640×480). As zonas de uso frequente (fila, balcão, bancada, tachos, estufa, moenda) ficam acima da
 * faixa coberta pelo painel; mesas, expedição, escritório e descanso ficam abaixo (RN-74, RN-75).
 */
export function buildLayout(stations: readonly StationId[], opts: LayoutOptions = {}): Layout {
  const zones: Zone[] = [];
  const add = (id: ZoneId, x: number, y: number, w: number, h: number, label: string) => zones.push({ id, x, y, w, h, label });
  const coolers = opts.coolers ?? 0;
  add('fila', 8, TOP_Y, 292, 118, 'FILA');
  if (stations.includes('balcao')) add('balcao', 306, TOP_Y, coolers > 0 ? 262 : 326, 118, LABELS.balcao);
  if (coolers > 0) add('caixa', 574, TOP_Y, 58, 118, 'CAIXA');

  const mid = MID.filter((id) => stations.includes(id));
  const midW = Math.max(80, Math.min(132, Math.floor((W - 16 - GAP * (mid.length - 1)) / Math.max(1, mid.length))));
  mid.forEach((id, i) => add(id, 8 + i * (midW + GAP), MID_Y, midW, 134, LABELS[id]));

  let x = 8;
  for (const id of LOW.filter((s) => stations.includes(s))) {
    const w = id === 'mesas' ? 304 : 100;
    add(id, x, LOW_Y, w, PANEL.h - 12, LABELS[id]);
    x += w + GAP;
  }
  return { zones, byId: new Map(zones.map((z) => [z.id, z])) };
}

export const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Zona sob o ponto, ou null (RN-74). */
export function hitTest(layout: Layout, x: number, y: number): Zone | null {
  for (let i = layout.zones.length - 1; i >= 0; i--) if (inside(layout.zones[i], x, y)) return layout.zones[i];
  return null;
}

/** Zonas que o painel aberto cobre. */
export const coveredByPanel = (z: Zone): boolean => z.y + z.h > PANEL.y;

export const center = (z: Zone): { x: number; y: number } => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
