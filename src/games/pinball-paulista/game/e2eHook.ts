import { exposeE2E } from '../../../shared/e2e/hook';
import type { AWARDS } from './constants';
import type { PinballEngine } from './engine';
import type { Phase, ScoreKind } from './types';

/**
 * Gancho dos testes de ponta a ponta (`e2e/pinball-paulista`). Só existe quando a página de teste liga a
 * flag (`src/shared/e2e/hook.ts`); para o jogador é inerte. `state()` e `targets()` só leem; `prepare`
 * serve para pré-condições raras (levar a bola a um alvo, acender luzes) e cada uso é comentado no teste.
 */

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

export interface PinballE2EState {
  phase: Phase;
  /** Fase de antes da pausa. */
  prevPhase: Phase;
  score: number;
  record: number;
  newRecord: boolean;
  /** Bola atual (1..`BALLS_PER_GAME`; a extra repete o número). */
  ball: number;
  ballsTotal: number;
  mult: number;
  letters: boolean[];
  rolls: boolean[];
  bumperHits: number[];
  greens: number;
  /** Segundos restantes da Onda Verde (0 = desligada). */
  wave: number;
  /** Segundos restantes do segura-bola. */
  saver: number;
  tilt: boolean;
  /** Conta de trancos (cai `NUDGE_DECAY` por segundo). */
  nudges: number;
  extraPending: boolean;
  extraGiven: boolean;
  /** Segundos em que o Minhocão ainda fica "entupido". */
  kickCd: number;
  /** Lado da última ejeção do Minhocão (−1/+1). */
  kickDir: number;
  /** Próximo prêmio do Minhocão. */
  nextAward: (typeof AWARDS)[number];
  bonusBase: number;
  /** Tela de bônus aberta (base, multiplicador, total). */
  bonus: { base: number; mult: number; total: number } | null;
  /** Bônus de cada bola perdida neste jogo. */
  bonusLog: { base: number; mult: number; total: number }[];
  /** Carga do lançador (0..1). */
  charge: number;
  launched: boolean;
  message: string;
  /** Bolas na mesa (incluindo a da rampa e a presa no Minhocão). */
  balls: { x: number; y: number; vx: number; vy: number; rest: boolean; held: number }[];
  flippers: { angle: number; up: boolean }[];
  /** Spinners: velocidade (rad/s) e meias voltas acumuladas. */
  spin: { w: number; turns: number }[];
  /** Pontos por tipo de evento neste jogo: `n` eventos, `pts` pontos (soma = placar). */
  tally: Partial<Record<ScoreKind, { n: number; pts: number }>>;
  /** Tempo de jogo (s, sem pausa). */
  time: number;
}

export interface PinballTargets {
  /** Metades da mesa (zonas de toque dos flippers), em coordenadas lógicas. */
  flipperLeft: Rect;
  flipperRight: Rect;
  /** Seletores dos botões abaixo da mesa. */
  launch: string;
  nudge: string;
  flippers: Point[];
  bumpers: (Point & { r: number })[];
  rollovers: Point[];
  targets: { letter: string; x: number; y1: number; y2: number; nx: 1 | -1 }[];
  spinners: (Point & { w: number })[];
  slings: { a: Point; c: Point }[];
  kickout: Point & { r: number };
  gate: { x: number; y1: number; y2: number };
}

export interface PinballPrepare {
  /** Coloca a bola `i` (padrão 0) livre em (x, y) com velocidade (vx, vy). */
  ball(x: number, y: number, vx: number, vy: number, i?: number): void;
  /** Acende/ajusta luzes e contadores: letras, raias, batidas nos bumpers, multiplicador, próximo prêmio, entupido, segura-bola. */
  lights(o: {
    letters?: boolean[];
    rolls?: boolean[];
    bumperHits?: number[];
    mult?: number;
    nextAward?: (typeof AWARDS)[number];
    kickCd?: number;
    saver?: number;
  }): void;
}

export interface PinballE2E {
  state(): PinballE2EState;
  targets(): PinballTargets;
  prepare: PinballPrepare;
}

/** Publica o gancho do motor montado; devolve o `dispose` do cleanup do efeito. */
export function exposePinball(engine: PinballEngine): () => void {
  return exposeE2E<PinballE2E>('pinball-paulista', {
    state: () => engine.e2eState(),
    targets: () => engine.e2eTargets(),
    prepare: engine.e2ePrepare,
  });
}
