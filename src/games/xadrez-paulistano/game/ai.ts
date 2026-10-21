import {
  BISHOP,
  colorOf,
  FLAG_CAPTURE,
  FLAG_EP,
  fileOf,
  KNIGHT,
  moveFlags,
  moveFrom,
  movePromo,
  moveTo,
  PAWN,
  type Position,
  QUEEN,
  rankOf,
  ROOK,
  typeOf,
  WHITE,
} from './chess';
import { AI_TT_SIZE } from './constants';
import { levelProfile } from './levels';

/**
 * O computador: busca alfa-beta com aprofundamento iterativo, PVS, tabela de transposição,
 * lance nulo, redução de lances tardios, killers/história e busca quiescente. A avaliação é
 * material + tabelas de posição (abertura/final interpolados) + estrutura de peões.
 * A força vem de `levelProfile` (tempo, profundidade, ruído e chance de lance aleatório).
 * Roda dentro de `ai.worker.ts` para não travar a tela.
 */

const MATE = 30000;
const INF = 32000;
const MAX_PLY = 96;

const VALUE = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

// Tabelas de posição do ponto de vista das brancas, da 8ª fileira (a8) para a 1ª (h1).
// prettier-ignore
const PST_PAWN_MG = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];
// prettier-ignore
const PST_PAWN_EG = [
   0,  0,  0,  0,  0,  0,  0,  0,
  80, 80, 80, 80, 80, 80, 80, 80,
  50, 50, 50, 50, 50, 50, 50, 50,
  30, 30, 30, 30, 30, 30, 30, 30,
  15, 15, 15, 15, 15, 15, 15, 15,
   5,  5,  5,  5,  5,  5,  5,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,
];
// prettier-ignore
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
// prettier-ignore
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];
// prettier-ignore
const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];
// prettier-ignore
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];
// prettier-ignore
const PST_KING_MG = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];
// prettier-ignore
const PST_KING_EG = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

const PST_MG = [[], PST_PAWN_MG, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, PST_KING_MG];
const PST_EG = [[], PST_PAWN_EG, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, PST_KING_EG];

/** Bônus do peão passado pela fileira relativa (0 = casa inicial das brancas). */
const PASSED = [0, 5, 10, 20, 35, 60, 100, 0];
const DOUBLED = 10;
const ISOLATED = 12;
const BISHOP_PAIR = 30;
const ROOK_OPEN = 15;
const ROOK_HALF_OPEN = 7;

/** Nota da posição em centipeões, do ponto de vista de quem joga. */
export function evaluate(pos: Position): number {
  const b = pos.board;
  const mg = [0, 0];
  const eg = [0, 0];
  const material = [0, 0];
  const bishops = [0, 0];
  const pawnCount = [new Int8Array(8), new Int8Array(8)];
  // fileira do peão mais avançado de cada cor por coluna (para peão passado)
  const whiteMin = new Int8Array(8).fill(8);
  const blackMax = new Int8Array(8).fill(-1);
  const pawns: number[] = [];
  const rooks: number[] = [];
  let phase = 0;

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const pc = b[sq];
    if (!pc) continue;
    const t = typeOf(pc);
    const c = colorOf(pc);
    const f = fileOf(sq);
    const r = rankOf(sq);
    const idx = c === WHITE ? (7 - r) * 8 + f : r * 8 + f;
    mg[c] += VALUE[t] + PST_MG[t][idx];
    eg[c] += VALUE[t] + PST_EG[t][idx];
    phase += PHASE[t];
    if (t !== PAWN) material[c] += VALUE[t];
    if (t === PAWN) {
      pawnCount[c][f]++;
      pawns.push(sq);
      if (c === WHITE) whiteMin[f] = Math.min(whiteMin[f], r);
      else blackMax[f] = Math.max(blackMax[f], r);
    } else if (t === BISHOP) bishops[c]++;
    else if (t === ROOK) rooks.push(sq);
  }

  for (const sq of pawns) {
    const c = colorOf(b[sq]);
    const f = fileOf(sq);
    const r = rankOf(sq);
    const own = pawnCount[c];
    if (own[f] > 1) {
      mg[c] -= DOUBLED;
      eg[c] -= DOUBLED;
    }
    if ((f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) {
      mg[c] -= ISOLATED;
      eg[c] -= ISOLATED;
    }
    let passed = true;
    for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
      if (c === WHITE ? blackMax[ff] > r : whiteMin[ff] < r) passed = false;
    }
    if (passed) {
      const rel = c === WHITE ? r : 7 - r;
      mg[c] += PASSED[rel] >> 1;
      eg[c] += PASSED[rel];
    }
  }
  for (const sq of rooks) {
    const c = colorOf(b[sq]);
    const f = fileOf(sq);
    if (!pawnCount[c][f]) {
      const bonus = pawnCount[c ^ 1][f] ? ROOK_HALF_OPEN : ROOK_OPEN;
      mg[c] += bonus;
      eg[c] += bonus;
    }
  }
  for (const c of [0, 1]) {
    if (bishops[c] >= 2) {
      mg[c] += BISHOP_PAIR;
      eg[c] += BISHOP_PAIR;
    }
  }

  const ph = Math.min(phase, 24);
  let score = Math.round(((mg[0] - mg[1]) * ph + (eg[0] - eg[1]) * (24 - ph)) / 24);

  // final ganho: empurra o rei perdedor para a borda e aproxima o rei vencedor (para saber dar mate)
  const diff = material[0] - material[1];
  if (ph <= 6 && Math.abs(diff) >= 300) {
    const winner = diff > 0 ? 0 : 1;
    const wk = pos.kings[winner];
    const lk = pos.kings[winner ^ 1];
    const lf = fileOf(lk);
    const lr = rankOf(lk);
    const center = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
    const dist = Math.abs(fileOf(wk) - lf) + Math.abs(rankOf(wk) - lr);
    const bonus = 10 * center + 4 * (14 - dist);
    score += winner === 0 ? bonus : -bonus;
  }
  return pos.turn === WHITE ? score : -score;
}

const TT_EMPTY = 0;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;

interface RootMove {
  move: number;
  score: number;
}

export class Searcher {
  private readonly mask = AI_TT_SIZE - 1;
  private readonly ttKey = new Int32Array(AI_TT_SIZE);
  private readonly ttMove = new Int32Array(AI_TT_SIZE);
  private readonly ttScore = new Int32Array(AI_TT_SIZE);
  private readonly ttDepth = new Int8Array(AI_TT_SIZE);
  private readonly ttFlag = new Uint8Array(AI_TT_SIZE);
  private readonly killers = new Int32Array(MAX_PLY * 2);
  private readonly history = new Int32Array(16 * 128);
  private pos!: Position;
  private nodes = 0;
  private deadline = 0;
  private stopped = false;
  private quiescence = true;

  /** Escolhe um lance para `pos` no nível 1–100 (0 se não houver lance legal). */
  choose(pos: Position, level: number, random: () => number = Math.random): number {
    const prof = levelProfile(level);
    const legal = pos.legalMoves();
    if (legal.length <= 1) return legal[0] ?? 0;
    if (random() < prof.blunder) return legal[Math.floor(random() * legal.length)];

    this.pos = pos;
    this.quiescence = prof.quiescence;
    this.nodes = 0;
    this.stopped = false;
    this.killers.fill(0);
    this.history.fill(0);
    const start = performance.now();
    this.deadline = start + prof.timeMs;

    // embaralha para variar entre lances de mesma nota
    for (let i = legal.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [legal[i], legal[j]] = [legal[j], legal[i]];
    }
    let root: RootMove[] = legal.map((move) => ({ move, score: 0 }));
    for (let depth = 1; depth <= prof.depth; depth++) {
      const done = this.searchRoot(root, depth, prof.noise);
      root = done;
      if (this.stopped) break;
      if (Math.abs(root[0].score) > MATE - MAX_PLY) break;
      if (performance.now() - start > prof.timeMs * 0.55) break;
    }

    if (!prof.noise) return root[0].move;
    let best = root[0];
    let bestNoisy = -Infinity;
    for (const rm of root) {
      const noisy = rm.score + (random() * 2 - 1) * prof.noise;
      if (noisy > bestNoisy) {
        bestNoisy = noisy;
        best = rm;
      }
    }
    return best.move;
  }

  /**
   * Uma iteração na raiz. Sem ruído: PVS normal (só o melhor tem nota exata). Com ruído: cada lance
   * recebe uma nota até `melhor - 3·ruído`, para o sorteio comparar lances parecidos de verdade.
   * Se o tempo acabar no meio, mantém a ordem anterior, mas promove um lance que já tenha batido o
   * primeiro numa busca completa.
   */
  private searchRoot(root: RootMove[], depth: number, noise: number): RootMove[] {
    const pos = this.pos;
    const scored: RootMove[] = [];
    let alpha = -INF;
    let best: RootMove | null = null;
    for (let i = 0; i < root.length; i++) {
      const move = root[i].move;
      pos.make(move);
      let score: number;
      if (noise) {
        const floor = i === 0 ? -INF : alpha - 3 * noise;
        score = -this.negamax(depth - 1, -INF, -floor, 1, true);
      } else if (i === 0) {
        score = -this.negamax(depth - 1, -INF, INF, 1, true);
      } else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, 1, true);
        if (score > alpha && !this.stopped) score = -this.negamax(depth - 1, -INF, -alpha, 1, true);
      }
      pos.unmake();
      if (this.stopped) {
        if (best && best.move !== root[0].move) return [best, ...root.filter((r) => r.move !== best!.move)];
        return root;
      }
      const rm = { move, score };
      scored.push(rm);
      if (score > alpha) {
        alpha = score;
        best = rm;
      }
    }
    return scored.sort((a, b) => b.score - a.score);
  }

  private timeUp(): boolean {
    if ((++this.nodes & 1023) === 0 && performance.now() > this.deadline) this.stopped = true;
    return this.stopped;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    if (this.timeUp()) return 0;
    const pos = this.pos;
    if (pos.halfmove >= 100 || pos.repetitions() > 0) return 0;
    const us = pos.turn;
    const inCheck = pos.inCheck(us);
    if (inCheck) depth++;
    if (depth <= 0) return this.quiescence ? this.quiesce(alpha, beta, ply) : evaluate(pos);
    if (ply >= MAX_PLY - 1) return evaluate(pos);

    alpha = Math.max(alpha, -MATE + ply);
    beta = Math.min(beta, MATE - ply - 1);
    if (alpha >= beta) return alpha;

    const idx = pos.hashLo & this.mask;
    let ttMove = 0;
    if (this.ttFlag[idx] !== TT_EMPTY && this.ttKey[idx] === pos.hashHi) {
      ttMove = this.ttMove[idx];
      if (this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s > MATE - MAX_PLY) s -= ply;
        else if (s < -MATE + MAX_PLY) s += ply;
        const flag = this.ttFlag[idx];
        if (flag === TT_EXACT || (flag === TT_LOWER && s >= beta) || (flag === TT_UPPER && s <= alpha)) return s;
      }
    }

    const pvNode = beta - alpha > 1;
    if (allowNull && !pvNode && !inCheck && depth >= 3 && this.hasPieces(us) && evaluate(pos) >= beta) {
      pos.makeNull();
      const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmake();
      if (this.stopped) return 0;
      if (s >= beta) return beta;
    }

    const moves = pos.genMoves([]);
    const order = this.orderScores(moves, ttMove, ply);
    const alphaStart = alpha;
    let best = -INF;
    let bestMove = 0;
    let legal = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = pickNext(moves, order, i);
      pos.make(m);
      if (pos.inCheck(us)) {
        pos.unmake();
        continue;
      }
      legal++;
      const quiet = !(moveFlags(m) & FLAG_CAPTURE) && !movePromo(m);
      let s: number;
      if (legal === 1) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        const reduce = depth >= 3 && legal > 3 && quiet && !inCheck && !pos.inCheck() ? (legal > 8 ? 2 : 1) : 0;
        s = -this.negamax(depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && reduce) s = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && s < beta) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (s > best) {
        best = s;
        bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (alpha >= beta) {
            if (quiet) {
              if (this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              const h = pos.board[moveFrom(m)] * 128 + moveTo(m);
              this.history[h] += depth * depth;
              if (this.history[h] > 400000) for (let k = 0; k < this.history.length; k++) this.history[k] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;

    this.ttKey[idx] = pos.hashHi;
    this.ttMove[idx] = bestMove;
    this.ttScore[idx] = best > MATE - MAX_PLY ? best + ply : best < -MATE + MAX_PLY ? best - ply : best;
    this.ttDepth[idx] = depth;
    this.ttFlag[idx] = best <= alphaStart ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT;
    return best;
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    if (this.timeUp()) return 0;
    const pos = this.pos;
    const stand = evaluate(pos);
    if (ply >= MAX_PLY - 1 || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const us = pos.turn;
    const moves = pos.genMoves([], true);
    const order = this.orderScores(moves, 0, ply);
    for (let i = 0; i < moves.length; i++) {
      const m = pickNext(moves, order, i);
      const victim = moveFlags(m) & FLAG_EP ? PAWN : typeOf(pos.board[moveTo(m)]);
      if (!movePromo(m) && stand + VALUE[victim] + 200 < alpha) continue; // nem ganhando a peça chega lá
      pos.make(m);
      if (pos.inCheck(us)) {
        pos.unmake();
        continue;
      }
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  private orderScores(moves: number[], ttMove: number, ply: number): number[] {
    const b = this.pos.board;
    const k1 = ply < MAX_PLY ? this.killers[ply * 2] : 0;
    const k2 = ply < MAX_PLY ? this.killers[ply * 2 + 1] : 0;
    return moves.map((m) => {
      if (m === ttMove) return 10_000_000;
      const flags = moveFlags(m);
      if (flags & FLAG_CAPTURE) {
        const victim = flags & FLAG_EP ? PAWN : typeOf(b[moveTo(m)]);
        return 1_000_000 + victim * 10 - typeOf(b[moveFrom(m)]);
      }
      if (movePromo(m)) return 900_000 + movePromo(m);
      if (m === k1) return 800_000;
      if (m === k2) return 700_000;
      return this.history[b[moveFrom(m)] * 128 + moveTo(m)];
    });
  }

  /** Tem peça além de peões e rei? (sem isso o lance nulo erra em finais de zugzwang) */
  private hasPieces(color: number): boolean {
    const b = this.pos.board;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const pc = b[sq];
      if (pc && colorOf(pc) === color) {
        const t = typeOf(pc);
        if (t === KNIGHT || t === BISHOP || t === ROOK || t === QUEEN) return true;
      }
    }
    return false;
  }
}

/** Seleção parcial: traz para a posição `i` o lance de maior nota ainda não tentado. */
function pickNext(moves: number[], order: number[], i: number): number {
  let bi = i;
  for (let j = i + 1; j < moves.length; j++) if (order[j] > order[bi]) bi = j;
  if (bi !== i) {
    [moves[i], moves[bi]] = [moves[bi], moves[i]];
    [order[i], order[bi]] = [order[bi], order[i]];
  }
  return moves[i];
}

