import { Searcher, seededRandom } from './ai';
import { moveToUci, Position, uciToMove } from './chess';

/** Pedido do motor: posição inicial + lances jogados (UCI), para a IA conhecer as repetições. */
export interface AiRequest {
  id: number;
  fen: string;
  moves: string[];
  level: number;
  /** Só nos testes: semente do sorteio da busca (sem ela, `Math.random`). */
  seed?: number;
  /** Só nos testes: a busca para em `nodeBudget` nós em vez de pelo tempo do nível. */
  nodeBudget?: number;
}

export interface AiResponse {
  id: number;
  move: string;
}

const searcher = new Searcher();
const scope = self as unknown as { onmessage: ((e: MessageEvent<AiRequest>) => void) | null; postMessage(msg: AiResponse): void };

scope.onmessage = (e) => {
  const { id, fen, moves, level, seed, nodeBudget } = e.data;
  const pos = Position.fromFen(fen);
  for (const uci of moves) pos.make(uciToMove(pos, uci));
  const move = searcher.choose(pos, level, seed === undefined ? Math.random : seededRandom(seed), nodeBudget);
  scope.postMessage({ id, move: move ? moveToUci(move) : '' });
};
