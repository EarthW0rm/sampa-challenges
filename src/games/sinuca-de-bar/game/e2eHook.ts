import { exposeE2E } from '../../../shared/e2e/hook';
import type { Level, Shot } from './ai';
import type { BallInHand, Group, RuleSet } from './rules';
import type { GameMode } from './types';

/**
 * Gancho dos testes de ponta a ponta (`e2e/sinuca-de-bar`). Só existe quando a página de teste liga a
 * flag (`src/shared/e2e/hook.ts`); para o jogador é inerte. `state()` e `targets()` só leem; `prepare`
 * monta pré-condições raras (mesa de uma falta, vez e grupos) e cada uso é comentado no teste.
 */

export interface SinucaE2EBall {
  n: number;
  x: number;
  y: number;
  on: boolean;
  moving: boolean;
}

export interface SinucaE2ELastShot {
  /** Quem tacou. */
  by: 0 | 1;
  isBreak: boolean;
  firstHit: number | null;
  pocketed: number[];
  foul: string | null;
  again: boolean;
  assigned: Group | null;
  respotCastigo: boolean;
  respotCue: boolean;
}

export interface SinucaE2EState {
  mode: GameMode;
  rules: RuleSet;
  level: Level;
  castigo: number;
  names: [string, string];
  phase: 'aim' | 'stroke' | 'rolling' | 'over';
  turn: 0 | 1;
  groups: [Group | null, Group | null];
  isBreak: boolean;
  ballInHand: BallInHand;
  onCastigo: [boolean, boolean];
  /** Bolas que o jogador da vez pode tocar primeiro. */
  legal: number[];
  winner: 0 | 1 | null;
  endReason: string | null;
  /** Vitórias da sessão. */
  wins: [number, number];
  /** Quem deu (ou dá) a saída desta partida. */
  breaker: 0 | 1;
  /** Bolas (0 = branca) em coordenadas lógicas. */
  balls: SinucaE2EBall[];
  /** Mira (radianos, 0 = direita, sentido horário na tela). */
  aim: number;
  /** Força (0,05–1). */
  power: number;
  /** Primeira coisa na linha de mira: bola (e se pode ser tocada primeiro) ou tabela (`ball` null). */
  guide: { dist: number; ball: number | null; legal: boolean };
  draggingCue: boolean;
  /** A branca está num lugar válido para a bola na mão atual. */
  canPlace: boolean;
  /** Vez do computador em andamento. */
  cpu: { stage: 'think' | 'aim'; t: number; ready: boolean } | null;
  thinking: boolean;
  /** Tacadas decididas nesta sessão. */
  shots: number;
  lastShot: SinucaE2ELastShot | null;
  /** Avisos na mesa (sem acento, maiúsculos, como desenhados). */
  toasts: string[];
  ai: { worker: boolean; requests: number; received: number; discarded: number; fallback: number; lastShot: Shot | null };
}

export interface SinucaE2ETargets {
  balls: { n: number; x: number; y: number }[];
  pockets: { x: number; y: number; r: number }[];
  headX: number;
  felt: { l: number; r: number; t: number; b: number };
}

export interface SinucaE2EPrepareTurn {
  groups?: [Group | null, Group | null];
  isBreak?: boolean;
  ballInHand?: BallInHand;
}

export interface SinucaE2E {
  state(): SinucaE2EState;
  /** Alvos lógicos do canvas e os retângulos (página) dos controles. */
  targets(): SinucaE2ETargets & { buttons: Record<string, Rect | null> };
  prepare: {
    balls(list: { n: number; x: number; y: number; on?: boolean }[]): void;
    turn(p: 0 | 1, opts?: SinucaE2EPrepareTurn): void;
  };
}

interface Engine {
  e2eState(): SinucaE2EState;
  e2eTargets(): SinucaE2ETargets;
  e2ePrepareBalls(list: readonly { n: number; x: number; y: number; on?: boolean }[]): void;
  e2ePrepareTurn(p: 0 | 1, opts?: SinucaE2EPrepareTurn): void;
}

const BUTTONS: Record<string, string> = {
  left: 'button[aria-label="Girar a mira para a esquerda"]',
  fineLeft: 'button[aria-label="Ajuste fino para a esquerda"]',
  fineRight: 'button[aria-label="Ajuste fino para a direita"]',
  right: 'button[aria-label="Girar a mira para a direita"]',
  power: 'input[type="range"]',
  shoot: 'button.shoot',
};

type Rect = { x: number; y: number; w: number; h: number };

function buttonRects(): Record<string, Rect | null> {
  const out: Record<string, Rect | null> = {};
  for (const [k, sel] of Object.entries(BUTTONS)) {
    const el = document.querySelector(`.sinuca-de-bar ${sel}`);
    const r = el?.getBoundingClientRect();
    out[k] = r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  }
  return out;
}

/** Publica o gancho do motor; devolve o `dispose` do cleanup do efeito. */
export function exposeSinuca(engine: Engine): () => void {
  return exposeE2E<SinucaE2E>('sinuca-de-bar', {
    state: () => engine.e2eState(),
    targets: () => ({ ...engine.e2eTargets(), buttons: buttonRects() }),
    prepare: {
      balls: (list) => engine.e2ePrepareBalls(list),
      turn: (p, opts) => engine.e2ePrepareTurn(p, opts),
    },
  });
}
