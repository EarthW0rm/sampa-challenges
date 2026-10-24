import type { Command, ItemRef, StationId } from './types';

/** Estado só da apresentação (painel aberto, seleção). Não entra na simulação. */
export interface UiState {
  /** Estação do painel aberto, ou null. */
  panel: StationId | null;
  /** Destino tocado: o painel abre quando o pasteleiro chega. */
  pending: StationId | null;
  /** Segundos sem interação com o painel (recolhe em 4 s, D-05). */
  idle: number;
  /** Item pronto escolhido para entregar. */
  selected: ItemRef | null;
  /** Soltar o controle segurado envia estes comandos. */
  release: (() => Command[]) | null;
  /** Contador de ids de gesto. */
  gesture: number;
  /** Relógio de animação em segundos (não pausa a UI). */
  clock: number;
}

export const createUi = (): UiState => ({
  panel: null,
  pending: null,
  idle: 0,
  selected: null,
  release: null,
  gesture: 0,
  clock: 0,
});

/** Painel recolhe depois de 4 s sem interação (D-05). */
export const PANEL_IDLE_SECONDS = 4;
