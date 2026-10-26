/**
 * Jogador do lado do Node: o próprio `Searcher` do jogo, com semente e orçamento de nós fixos, decide o
 * lance a partir da posição lida pelo gancho. Mesma posição + mesma semente = mesmo lance.
 */
import { Searcher, seededRandom } from '../../../src/games/xadrez-paulistano/game/ai';
import { moveToUci, Position, uciToMove } from '../../../src/games/xadrez-paulistano/game/chess';

export class NodeBrain {
  private readonly searcher = new Searcher();

  constructor(
    readonly level: number,
    readonly nodeBudget: number,
    readonly seed: number,
  ) {}

  /** Lance UCI para a partida que começou em `startFen` com os lances `ucis` (a IA enxerga as repetições). */
  choose(startFen: string, ucis: string[]): string {
    const pos = Position.fromFen(startFen);
    for (const u of ucis) pos.make(uciToMove(pos, u));
    const m = this.searcher.choose(pos, this.level, seededRandom((this.seed ^ Math.imul(ucis.length + 1, 0x9e3779b1)) >>> 0), this.nodeBudget);
    return moveToUci(m);
  }
}

