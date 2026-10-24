import { H, W } from './constants';
import type { StationId } from './types';

/** Zonas fixas da barraca em coordenadas lógicas 640×480 (RN-74, RN-75). Só leitura. */

export type ZoneId = StationId | 'fila';

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
  balcao: 'BALCAO', bancada: 'BANCADA', tacho1: 'TACHO 1', tacho2: 'TACHO 2', tacho3: 'TACHO 3', estufa: 'ESTUFA',
  moenda: 'MOENDA', mesas: 'MESAS', expedicao: 'EXPEDICAO', escritorio: 'ESCRITORIO', descanso: 'DESCANSO',
};
export const stationLabel = (id: StationId): string => LABELS[id];

const MID: readonly StationId[] = ['bancada', 'tacho1', 'tacho2', 'tacho3', 'estufa', 'moenda'];
const LOW: readonly StationId[] = ['mesas', 'expedicao', 'escritorio', 'descanso'];

const TOP_Y = 30;
const MID_Y = 158;
const LOW_Y = PANEL.y + 6;
const GAP = 6;

/** Monta as zonas a partir das estações que existem. As de uso frequente ficam acima do painel. */
export function buildLayout(stations: readonly StationId[]): Layout {
  const zones: Zone[] = [];
  const add = (id: ZoneId, x: number, y: number, w: number, h: number, label: string) => zones.push({ id, x, y, w, h, label });
  add('fila', 8, TOP_Y, 320, 118, 'FILA');
  if (stations.includes('balcao')) add('balcao', 336, TOP_Y, 296, 118, LABELS.balcao);

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
