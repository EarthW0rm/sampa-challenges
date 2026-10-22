import { chooseShot, type Level, type Shot } from './ai';
import type { Ball } from './physics';
import type { MatchState } from './rules';

/** Pedido do motor: a mesa e o estado da partida na vez do computador. */
export interface AiRequest {
  id: number;
  balls: Ball[];
  state: MatchState;
  level: Level;
}

export interface AiResponse {
  id: number;
  shot: Shot;
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<AiRequest>) => void) | null; postMessage(msg: AiResponse): void };

scope.onmessage = (e) => {
  const { id, balls, state, level } = e.data;
  scope.postMessage({ id, shot: chooseShot(balls, state, level) });
};
