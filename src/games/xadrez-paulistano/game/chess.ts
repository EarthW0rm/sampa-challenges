/**
 * Regras completas do xadrez (sem React, sem canvas): tabuleiro 0x88, geração de lances legais,
 * roque, en passant, promoção, xeque, mate, afogamento, 50 lances, repetição tripla, material
 * insuficiente, notação algébrica em português (R D T B C) e hash Zobrist para a IA.
 *
 * Casa = `rank * 16 + file` (rank 0 = 1ª fileira das brancas, file 0 = coluna a).
 * Peça = `tipo | (cor << 3)`; 0 = vazia.
 * Lance = número: `from | to << 7 | promo << 14 | flags << 17`.
 */

export type Color = 0 | 1;
export const WHITE: Color = 0;
export const BLACK: Color = 1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const FLAG_CAPTURE = 1;
export const FLAG_EP = 2;
export const FLAG_CASTLE = 4;
export const FLAG_DOUBLE = 8;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const makePiece = (type: number, color: Color) => type | (color << 3);
export const typeOf = (p: number) => p & 7;
export const colorOf = (p: number) => (p >> 3) as Color;
export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 4;
export const square = (file: number, rank: number) => rank * 16 + file;
export const onBoard = (sq: number) => (sq & 0x88) === 0;

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
export const moveFlags = (m: number) => (m >> 17) & 15;
const encode = (from: number, to: number, promo: number, flags: number) => from | (to << 7) | (promo << 14) | (flags << 17);

const KNIGHT_STEPS = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_STEPS = [1, -1, 16, -16, 15, 17, -15, -17];
const BISHOP_RAYS = [15, 17, -15, -17];
const ROOK_RAYS = [1, -1, 16, -16];

/** Direitos de roque: 1 = O-O brancas, 2 = O-O-O brancas, 4 = O-O pretas, 8 = O-O-O pretas. */
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[square(4, 0)] = 15 & ~3;
CASTLE_MASK[square(7, 0)] = 15 & ~1;
CASTLE_MASK[square(0, 0)] = 15 & ~2;
CASTLE_MASK[square(4, 7)] = 15 & ~12;
CASTLE_MASK[square(7, 7)] = 15 & ~4;
CASTLE_MASK[square(0, 7)] = 15 & ~8;

// ---------------------------------------------------------------- Zobrist (64 bits em 2 × 32)

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
}
const rnd32 = mulberry32(0x5a0a);
const Z_PIECE = Int32Array.from({ length: 16 * 128 * 2 }, rnd32);
const Z_CASTLE = Int32Array.from({ length: 16 * 2 }, rnd32);
const Z_EP = Int32Array.from({ length: 8 * 2 }, rnd32);
const Z_SIDE = Int32Array.from({ length: 2 }, rnd32);

interface Undo {
  move: number;
  captured: number;
  castling: number;
  ep: number;
  halfmove: number;
  hashLo: number;
  hashHi: number;
}

export class Position {
  board = new Int8Array(128);
  turn: Color = WHITE;
  castling = 0;
  /** Casa de en passant (atrás do peão que andou duas), ou -1. */
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = [square(4, 0), square(4, 7)];
  hashLo = 0;
  hashHi = 0;
  private stack: Undo[] = [];
  /** Hashes das posições anteriores (pares lo, hi), para detectar repetição. */
  private hashes: number[] = [];

  static fromFen(fen: string = START_FEN): Position {
    const p = new Position();
    const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
    const ranks = placement.split('/');
    for (let i = 0; i < 8; i++) {
      let f = 0;
      for (const ch of ranks[i]) {
        if (/\d/.test(ch)) f += Number(ch);
        else {
          const type = ' pnbrqk'.indexOf(ch.toLowerCase());
          const color: Color = ch === ch.toUpperCase() ? WHITE : BLACK;
          const sq = square(f, 7 - i);
          p.board[sq] = makePiece(type, color);
          if (type === KING) p.kings[color] = sq;
          f++;
        }
      }
    }
    p.turn = turn === 'b' ? BLACK : WHITE;
    p.castling =
      (castling.includes('K') ? 1 : 0) | (castling.includes('Q') ? 2 : 0) | (castling.includes('k') ? 4 : 0) | (castling.includes('q') ? 8 : 0);
    p.ep = ep && ep !== '-' ? square(ep.charCodeAt(0) - 97, Number(ep[1]) - 1) : -1;
    p.halfmove = Number(half) || 0;
    p.fullmove = Number(full) || 1;
    p.rehash();
    return p;
  }

  fen(): string {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const pc = this.board[square(f, r)];
        if (!pc) {
          empty++;
          continue;
        }
        if (empty) s += empty;
        empty = 0;
        const ch = ' pnbrqk'[typeOf(pc)];
        s += colorOf(pc) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty) s += empty;
      if (r) s += '/';
    }
    const c = this.castling;
    const cs = (c & 1 ? 'K' : '') + (c & 2 ? 'Q' : '') + (c & 4 ? 'k' : '') + (c & 8 ? 'q' : '');
    return `${s} ${this.turn ? 'b' : 'w'} ${cs || '-'} ${this.ep < 0 ? '-' : squareName(this.ep)} ${this.halfmove} ${this.fullmove}`;
  }

  private rehash() {
    let lo = 0;
    let hi = 0;
    for (let sq = 0; sq < 128; sq++) {
      const pc = this.board[sq];
      if (onBoard(sq) && pc) {
        lo ^= Z_PIECE[(pc * 128 + sq) * 2];
        hi ^= Z_PIECE[(pc * 128 + sq) * 2 + 1];
      }
    }
    lo ^= Z_CASTLE[this.castling * 2];
    hi ^= Z_CASTLE[this.castling * 2 + 1];
    if (this.ep >= 0) {
      lo ^= Z_EP[fileOf(this.ep) * 2];
      hi ^= Z_EP[fileOf(this.ep) * 2 + 1];
    }
    if (this.turn) {
      lo ^= Z_SIDE[0];
      hi ^= Z_SIDE[1];
    }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  private xorPiece(pc: number, sq: number) {
    this.hashLo ^= Z_PIECE[(pc * 128 + sq) * 2];
    this.hashHi ^= Z_PIECE[(pc * 128 + sq) * 2 + 1];
  }

  private xorState() {
    this.hashLo ^= Z_CASTLE[this.castling * 2];
    this.hashHi ^= Z_CASTLE[this.castling * 2 + 1];
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP[fileOf(this.ep) * 2];
      this.hashHi ^= Z_EP[fileOf(this.ep) * 2 + 1];
    }
  }

  get plyCount(): number {
    return this.stack.length;
  }

  /** Joga um lance pseudo-legal. Depois, `inCheck(cor de quem jogou)` diz se ele era ilegal. */
  make(m: number) {
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const promo = movePromo(m);
    const b = this.board;
    const us = this.turn;
    const piece = b[from];
    let captured = b[to];

    this.stack.push({ move: m, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, hashLo: this.hashLo, hashHi: this.hashHi });
    this.hashes.push(this.hashLo, this.hashHi);
    this.xorState();

    if (flags & FLAG_EP) {
      const capSq = to + (us === WHITE ? -16 : 16);
      captured = b[capSq];
      b[capSq] = 0;
      this.xorPiece(captured, capSq);
    } else if (captured) {
      this.xorPiece(captured, to);
    }
    this.stack[this.stack.length - 1].captured = captured;

    this.xorPiece(piece, from);
    b[from] = 0;
    const placed = promo ? makePiece(promo, us) : piece;
    b[to] = placed;
    this.xorPiece(placed, to);

    if (flags & FLAG_CASTLE) {
      const rank = us === WHITE ? 0 : 7;
      const [rf, rt] = fileOf(to) === 6 ? [square(7, rank), square(5, rank)] : [square(0, rank), square(3, rank)];
      const rook = b[rf];
      b[rf] = 0;
      b[rt] = rook;
      this.xorPiece(rook, rf);
      this.xorPiece(rook, rt);
    }
    if (typeOf(piece) === KING) this.kings[us] = to;

    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = -1;
    if (flags & FLAG_DOUBLE) {
      // só vale como casa de en passant se houver peão inimigo ao lado (assim a repetição fica exata)
      const enemyPawn = makePiece(PAWN, (us ^ 1) as Color);
      if ((onBoard(to - 1) && b[to - 1] === enemyPawn) || (onBoard(to + 1) && b[to + 1] === enemyPawn)) this.ep = (from + to) >> 1;
    }
    this.xorState();

    this.halfmove = typeOf(piece) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = (us ^ 1) as Color;
    this.hashLo ^= Z_SIDE[0];
    this.hashHi ^= Z_SIDE[1];
  }

  unmake() {
    const u = this.stack.pop()!;
    this.hashes.length -= 2;
    const m = u.move;
    this.turn = (this.turn ^ 1) as Color;
    const us = this.turn;
    if (us === BLACK) this.fullmove--;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.hashLo = u.hashLo;
    this.hashHi = u.hashHi;
    if (m === 0) return; // lance nulo

    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const b = this.board;
    const placed = b[to];
    b[from] = movePromo(m) ? makePiece(PAWN, us) : placed;
    b[to] = 0;
    if (flags & FLAG_EP) b[to + (us === WHITE ? -16 : 16)] = u.captured;
    else b[to] = u.captured;
    if (flags & FLAG_CASTLE) {
      const rank = us === WHITE ? 0 : 7;
      const [rf, rt] = fileOf(to) === 6 ? [square(7, rank), square(5, rank)] : [square(0, rank), square(3, rank)];
      b[rf] = b[rt];
      b[rt] = 0;
    }
    if (typeOf(b[from]) === KING) this.kings[us] = from;
  }

  /** Passa a vez (poda de lance nulo da IA). Desfaça com `unmake()`. */
  makeNull() {
    this.stack.push({ move: 0, captured: 0, castling: this.castling, ep: this.ep, halfmove: this.halfmove, hashLo: this.hashLo, hashHi: this.hashHi });
    this.hashes.push(this.hashLo, this.hashHi);
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP[fileOf(this.ep) * 2];
      this.hashHi ^= Z_EP[fileOf(this.ep) * 2 + 1];
      this.ep = -1;
    }
    this.halfmove++;
    this.turn = (this.turn ^ 1) as Color;
    this.hashLo ^= Z_SIDE[0];
    this.hashHi ^= Z_SIDE[1];
  }

  lastMove(): number {
    return this.stack.length ? this.stack[this.stack.length - 1].move : 0;
  }

  lastCaptured(): number {
    return this.stack.length ? this.stack[this.stack.length - 1].captured : 0;
  }

  /** A casa `sq` é atacada por alguma peça da cor `by`? */
  attacked(sq: number, by: Color): boolean {
    const b = this.board;
    const pawn = makePiece(PAWN, by);
    if (by === WHITE) {
      if ((onBoard(sq - 15) && b[sq - 15] === pawn) || (onBoard(sq - 17) && b[sq - 17] === pawn)) return true;
    } else if ((onBoard(sq + 15) && b[sq + 15] === pawn) || (onBoard(sq + 17) && b[sq + 17] === pawn)) return true;
    const knight = makePiece(KNIGHT, by);
    for (const d of KNIGHT_STEPS) if (onBoard(sq + d) && b[sq + d] === knight) return true;
    const king = makePiece(KING, by);
    for (const d of KING_STEPS) if (onBoard(sq + d) && b[sq + d] === king) return true;
    const bishop = makePiece(BISHOP, by);
    const rook = makePiece(ROOK, by);
    const queen = makePiece(QUEEN, by);
    for (const d of BISHOP_RAYS) {
      for (let t = sq + d; onBoard(t); t += d) {
        const pc = b[t];
        if (pc) {
          if (pc === bishop || pc === queen) return true;
          break;
        }
      }
    }
    for (const d of ROOK_RAYS) {
      for (let t = sq + d; onBoard(t); t += d) {
        const pc = b[t];
        if (pc) {
          if (pc === rook || pc === queen) return true;
          break;
        }
      }
    }
    return false;
  }

  inCheck(color: Color = this.turn): boolean {
    return this.attacked(this.kings[color], (color ^ 1) as Color);
  }

  /**
   * Lances pseudo-legais (podem deixar o próprio rei em xeque) acrescentados em `out`.
   * `capturesOnly`: só capturas e promoções a dama (busca quiescente da IA).
   */
  genMoves(out: number[], capturesOnly = false): number[] {
    const b = this.board;
    const us = this.turn;
    const them = (us ^ 1) as Color;
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      const pc = b[from];
      if (!pc || colorOf(pc) !== us) continue;
      const type = typeOf(pc);
      if (type === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const lastRank = us === WHITE ? 7 : 0;
        const one = from + dir;
        if (onBoard(one) && !b[one]) {
          if (rankOf(one) === lastRank) {
            out.push(encode(from, one, QUEEN, 0));
            if (!capturesOnly) for (const p of [ROOK, BISHOP, KNIGHT]) out.push(encode(from, one, p, 0));
          } else if (!capturesOnly) {
            out.push(encode(from, one, 0, 0));
            const two = one + dir;
            if (rankOf(from) === startRank && !b[two]) out.push(encode(from, two, 0, FLAG_DOUBLE));
          }
        }
        for (const side of [-1, 1]) {
          const to = one + side;
          if (!onBoard(to)) continue;
          if (b[to] && colorOf(b[to]) === them) {
            if (rankOf(to) === lastRank) {
              out.push(encode(from, to, QUEEN, FLAG_CAPTURE));
              if (!capturesOnly) for (const p of [ROOK, BISHOP, KNIGHT]) out.push(encode(from, to, p, FLAG_CAPTURE));
            } else out.push(encode(from, to, 0, FLAG_CAPTURE));
          } else if (to === this.ep) out.push(encode(from, to, 0, FLAG_CAPTURE | FLAG_EP));
        }
        continue;
      }
      if (type === KNIGHT || type === KING) {
        for (const d of type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
          const to = from + d;
          if (!onBoard(to)) continue;
          const t = b[to];
          if (!t) {
            if (!capturesOnly) out.push(encode(from, to, 0, 0));
          } else if (colorOf(t) === them) out.push(encode(from, to, 0, FLAG_CAPTURE));
        }
      } else {
        const rays = type === BISHOP ? BISHOP_RAYS : type === ROOK ? ROOK_RAYS : KING_STEPS;
        for (const d of rays) {
          for (let to = from + d; onBoard(to); to += d) {
            const t = b[to];
            if (!t) {
              if (!capturesOnly) out.push(encode(from, to, 0, 0));
              continue;
            }
            if (colorOf(t) === them) out.push(encode(from, to, 0, FLAG_CAPTURE));
            break;
          }
        }
      }
    }
    if (!capturesOnly) this.genCastling(out);
    return out;
  }

  private genCastling(out: number[]) {
    const us = this.turn;
    const them = (us ^ 1) as Color;
    const rank = us === WHITE ? 0 : 7;
    const k = square(4, rank);
    const [kingSide, queenSide] = us === WHITE ? [1, 2] : [4, 8];
    const b = this.board;
    if (!(this.castling & (kingSide | queenSide)) || b[k] !== makePiece(KING, us) || this.attacked(k, them)) return;
    if (this.castling & kingSide && !b[k + 1] && !b[k + 2] && !this.attacked(k + 1, them) && !this.attacked(k + 2, them))
      out.push(encode(k, k + 2, 0, FLAG_CASTLE));
    if (this.castling & queenSide && !b[k - 1] && !b[k - 2] && !b[k - 3] && !this.attacked(k - 1, them) && !this.attacked(k - 2, them))
      out.push(encode(k, k - 2, 0, FLAG_CASTLE));
  }

  legalMoves(): number[] {
    const us = this.turn;
    const legal: number[] = [];
    for (const m of this.genMoves([])) {
      this.make(m);
      if (!this.inCheck(us)) legal.push(m);
      this.unmake();
    }
    return legal;
  }

  /** Quantas vezes a posição atual já apareceu antes (mesmo lado a jogar, desde o último lance irreversível). */
  repetitions(): number {
    const h = this.hashes;
    let count = 0;
    for (let k = 4; k <= this.halfmove * 2 && k <= h.length; k += 4) {
      if (h[h.length - k] === this.hashLo && h[h.length - k + 1] === this.hashHi) count++;
    }
    return count;
  }

  /** Material insuficiente para qualquer lado dar mate (K×K, K+menor×K, K+B×K+B com bispos da mesma cor). */
  insufficientMaterial(): boolean {
    let minors = 0;
    const bishopColors: number[] = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const t = typeOf(this.board[sq]);
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      if (t === KNIGHT || t === BISHOP) minors++;
      if (t === BISHOP) bishopColors.push((fileOf(sq) + rankOf(sq)) & 1);
    }
    if (minors <= 1) return true;
    return minors === bishopColors.length && bishopColors.every((c) => c === bishopColors[0]);
  }
}

// ---------------------------------------------------------------- resultado da partida

export type Outcome =
  | { kind: 'checkmate' | 'resign'; winner: Color }
  | { kind: 'stalemate' | 'fifty' | 'repetition' | 'material' };

/** Resultado da posição (`legal` = lances legais dela), ou null se a partida continua. */
export function gameOutcome(pos: Position, legal: number[]): Outcome | null {
  if (!legal.length) return pos.inCheck() ? { kind: 'checkmate', winner: (pos.turn ^ 1) as Color } : { kind: 'stalemate' };
  if (pos.halfmove >= 100) return { kind: 'fifty' };
  if (pos.repetitions() >= 2) return { kind: 'repetition' };
  if (pos.insufficientMaterial()) return { kind: 'material' };
  return null;
}

// ---------------------------------------------------------------- notação

export const squareName = (sq: number) => String.fromCharCode(97 + fileOf(sq)) + (rankOf(sq) + 1);

/** Letras em português: R rei, D dama, T torre, B bispo, C cavalo. */
const SAN_LETTER = ['', '', 'C', 'B', 'T', 'D', 'R'];

/** Notação algébrica (em português) de um lance legal `m`, calculada antes de jogá-lo. */
export function moveToSan(pos: Position, m: number, legal: number[]): string {
  const from = moveFrom(m);
  const to = moveTo(m);
  const flags = moveFlags(m);
  const type = typeOf(pos.board[from]);
  let san: string;
  if (flags & FLAG_CASTLE) san = fileOf(to) === 6 ? 'O-O' : 'O-O-O';
  else if (type === PAWN) {
    san = flags & FLAG_CAPTURE ? `${squareName(from)[0]}x${squareName(to)}` : squareName(to);
    if (movePromo(m)) san += '=' + SAN_LETTER[movePromo(m)];
  } else {
    const rivals = legal.filter((o) => o !== m && moveTo(o) === to && typeOf(pos.board[moveFrom(o)]) === type).map(moveFrom);
    let dis = '';
    if (rivals.length) {
      if (rivals.every((r) => fileOf(r) !== fileOf(from))) dis = squareName(from)[0];
      else if (rivals.every((r) => rankOf(r) !== rankOf(from))) dis = squareName(from)[1];
      else dis = squareName(from);
    }
    san = SAN_LETTER[type] + dis + (flags & FLAG_CAPTURE ? 'x' : '') + squareName(to);
  }
  pos.make(m);
  if (pos.inCheck()) san += pos.legalMoves().length ? '+' : '#';
  pos.unmake();
  return san;
}

const PROMO_CHAR = ['', '', 'n', 'b', 'r', 'q'];

export function moveToUci(m: number): string {
  return squareName(moveFrom(m)) + squareName(moveTo(m)) + PROMO_CHAR[movePromo(m)];
}

/** Lance legal correspondente ao texto UCI (`e2e4`, `e7e8q`), ou 0. */
export function uciToMove(pos: Position, uci: string): number {
  return pos.legalMoves().find((m) => moveToUci(m) === uci) ?? 0;
}
