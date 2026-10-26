import { exposeE2E } from '../../../shared/e2e/hook';
import type { BoxKind, BoxState, HudState, PowerKind } from './types';

/**
 * Gancho dos testes de ponta a ponta (`e2e/cachorro-loko`). Só existe quando a página de teste liga a
 * flag (`src/shared/e2e/hook.ts`); para o jogador é inerte. `state()`, `events()` e `targets()` só leem;
 * `prepare` escreve pré-condições raras (cada uso é comentado no teste).
 */

export interface CLRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CLBox {
  id: number;
  kind: BoxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: BoxState;
  /** Esteira atual (0 a 3) ou a última por onde passou. */
  belt: number;
}

/** Evento da partida: pedido saiu, pacote desceu/foi para a rua num desvio, foi pego ou caiu. */
export interface CLEvent {
  /** Tempo de jogo (s) do motor. */
  t: number;
  ev: 'spawn' | 'desce' | 'rua' | 'catch' | 'land';
  id: number;
  kind: BoxKind;
  belt: number;
  x: number;
  /** Só em `catch`: pontos ganhos (0 na bomba) e se o dobro estava ativo. */
  points?: number;
  dobro?: boolean;
  /** Placar e vidas logo depois do evento. */
  score: number;
  lives: number;
}

export interface CLState {
  phase: HudState['phase'];
  score: number;
  /** Pacotes não-bomba pegos. */
  delivered: number;
  lives: number;
  level: number;
  record: number;
  startRecord: number;
  /** Tempo de jogo (s) do motor; não anda na pausa. */
  time: number;
  beltSpeed: number;
  spawnEvery: number;
  spawnTimer: number;
  sinceSpecial: number;
  /** Segundos restantes de cada poder (0 = inativo). */
  powers: Record<PowerKind, number>;
  dog: { x: number; facing: 1 | -1; moving: boolean; dizzy: number };
  /** Área de pega atual (lógica). */
  catchRect: CLRect;
  boxes: CLBox[];
  desvios: { state: 'desce' | 'rua'; flash: number }[];
  /** Quantidade de eventos registrados (use `events(from)`). */
  events: number;
}

export interface CLPrepare {
  /** Põe um pacote; padrão: na boca da esteira 1 (como o chapeiro). Devolve o id. */
  spawn(kind: BoxKind, at?: { x?: number; y?: number; vx?: number; vy?: number; state?: BoxState; belt?: number }): number;
  lives(n: number): void;
  score(n: number): void;
  /** Liga/desliga os pedidos automáticos do chapeiro. */
  chef(on: boolean): void;
}

export interface CachorroLokoE2E {
  state(): CLState;
  events(from?: number): CLEvent[];
  /** Zonas de toque em coordenadas da página e a área de pega em coordenadas lógicas. */
  targets(): { left: CLRect | null; right: CLRect | null; catchRect: CLRect };
  prepare: CLPrepare;
}

/** O que o gancho precisa do motor (métodos `e2e*` do `CachorroLokoEngine`). */
export interface CLEngineView {
  e2eState(): CLState;
  e2eEvents(from?: number): CLEvent[];
  e2eTargets(): { catchRect: CLRect };
  e2eSpawn: CLPrepare['spawn'];
  e2eSetLives(n: number): void;
  e2eSetScore(n: number): void;
  e2eChef(on: boolean): void;
}

const rectOf = (el: Element | null | undefined): CLRect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
};

/** Publica o gancho do motor montado; devolve o `dispose` do cleanup do efeito. */
export function exposeCachorroLoko(engine: CLEngineView, stage: () => Element | null): () => void {
  return exposeE2E<CachorroLokoE2E>('cachorro-loko', {
    state: () => engine.e2eState(),
    events: (from) => engine.e2eEvents(from),
    targets: () => {
      const s = stage();
      return { left: rectOf(s?.querySelector('.touch.left')), right: rectOf(s?.querySelector('.touch.right')), catchRect: engine.e2eTargets().catchRect };
    },
    prepare: {
      spawn: (kind, at) => engine.e2eSpawn(kind, at),
      lives: (n) => engine.e2eSetLives(n),
      score: (n) => engine.e2eSetScore(n),
      chef: (on) => engine.e2eChef(on),
    },
  });
}
