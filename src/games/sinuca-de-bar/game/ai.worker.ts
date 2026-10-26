import { chooseShot, type Level, type Shot } from './ai';
import type { Ball } from './physics';
import { mulberry32 } from './random';
import type { MatchState } from './rules';

/** Pedido do motor: a mesa e o estado da partida na vez do computador. */
export interface AiRequest {
  id: number;
  balls: Ball[];
  state: MatchState;
  level: Level;
  /** Semente da busca (só nos testes, `e2eSeed()`); sem ela a IA usa `Math.random`. */
  seed?: number;
}

export interface AiResponse {
  id: number;
  shot: Shot;
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<AiRequest>) => void) | null; postMessage(msg: AiResponse): void };

scope.onmessage = (e) => {
  const { id, balls, state, level, seed } = e.data;
  scope.postMessage({ id, shot: chooseShot(balls, state, level, seed === undefined ? Math.random : mulberry32(seed)) });
};
