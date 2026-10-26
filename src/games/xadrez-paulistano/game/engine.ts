import { isE2E, e2eSeed } from '../../../shared/e2e/hook';
import { Searcher, seededRandom } from './ai';
import type { AiRequest, AiResponse } from './ai.worker';
import { pieceKey, type Assets } from './assets';
import {
  BLACK,
  type Color,
  colorOf,
  FLAG_CAPTURE,
  FLAG_CASTLE,
  FLAG_EP,
  fileOf,
  gameOutcome,
  KING,
  moveFlags,
  moveFrom,
  movePromo,
  moveTo,
  moveToSan,
  moveToUci,
  type Outcome,
  Position,
  QUEEN,
  rankOf,
  square,
  squareName,
  START_FEN,
  typeOf,
  uciToMove,
  WHITE,
} from './chess';
import {
  AI_MIN_DELAY_MS,
  BOARD_X,
  BOARD_Y,
  BOX_BOTTOM_Y,
  BOX_H,
  BOX_TOP_Y,
  CAPTURED_PER_ROW,
  DRAG_THRESHOLD,
  E2E_NODES_PER_MS,
  MOVE_ANIM_S,
  PANEL_W,
  PANEL_X,
  SQ,
  STATUS_H,
  STATUS_Y,
} from './constants';
import { blit, SCALE, upscaleAll } from './hires';
import { levelProfile } from './levels';
import { drawPixelText, textWidth } from './pixelFont';
import { sfx } from './sound';
import type { HudState, Settings } from './types';

/**
 * Base da semente da IA nos testes, tirada do `Math.random` semeado quando o módulo carrega (antes de
 * qualquer gesto: o áudio, ao nascer, consome sorteios conforme a taxa de amostragem da máquina).
 */
const E2E_SEED_BASE = e2eSeed();

/** Pontos de material para o "+N" do painel. */
const POINTS = [0, 1, 3, 3, 5, 9, 0];
/** Posição de cada tipo na fila de capturadas do painel: dama, torre, bispo, cavalo, peão. */
const CAPTURE_ORDER = [9, 4, 3, 2, 1, 0, 9];

const COLOR_TEXT = '#f4efe2';
const COLOR_MUTED = '#8a8098';
const COLOR_ACCENT = '#ffd36b';
const COLOR_RED = '#ff4d5e';

/** Tira acentos e o que a fonte 3×5 não tem. */
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .!+-]/g, ' ');

/** Retrato lido pelo gancho dos testes (\`e2eHook.ts\`). Casas em notação \`e4\`; cores \`w\`/\`b\`. */
export interface XadrezE2EState {
  mode: Settings['mode'];
  level: number;
  autoFlip: boolean;
  fen: string;
  startFen: string;
  /** Lances em notação portuguesa (como na lista) e em UCI. */
  moves: string[];
  ucis: string[];
  plies: number;
  turn: 'w' | 'b';
  check: boolean;
  outcome: Outcome | null;
  selected: string | null;
  cursor: string | null;
  dragging: boolean;
  bottom: 'w' | 'b';
  humanColor: 'w' | 'b' | null;
  names: string[];
  /** Computador buscando o lance. */
  thinking: boolean;
  /** Lance do computador pronto, esperando \`AI_MIN_DELAY_MS\`. */
  aiPending: boolean;
  animating: boolean;
  flipPending: boolean;
  promotion: { color: 'w' | 'b'; from: string; to: string } | null;
  canUndo: boolean;
  /** O tabuleiro aceita entrada agora. */
  humanTurn: boolean;
  /** Destinos legais da peça selecionada. */
  legalTargets: string[];
  /** Há worker de IA vivo (false = reserva na thread principal). */
  worker: boolean;
  aiRequests: number;
  lastAiRequest: AiRequest | null;
}

interface Anim {
  piece: number;
  from: number;
  to: number;
  t: number;
  /** Peça capturada, desenhada embaixo até a chegada. */
  captured: number;
  capturedSq: number;
  rook: { piece: number; from: number; to: number } | null;
}

interface Drag {
  sq: number;
  x: number;
  y: number;
  moved: boolean;
  wasSelected: boolean;
}

/**
 * Partida de xadrez na tela: estado, entrada (clique, arrasto e teclado), vez do computador
 * (Web Worker com `ai.ts`), animações e desenho do canvas. O React só recebe o `HudState`.
 */
export class XadrezEngine {
  private readonly sprites: Record<string, HTMLCanvasElement>;
  /** Posição em que a partida começou (FEN): vai no pedido ao computador junto com os lances. */
  private startFen = START_FEN;
  private pos = Position.fromFen(START_FEN);
  private legal: number[] = [];
  private sans: string[] = [];
  private ucis: string[] = [];
  private captures: number[] = [];
  private outcome: Outcome | null = null;
  private humanColor: Color | null = null;
  private bottom: Color = WHITE;
  private names: [string, string] = ['', ''];

  private selected = -1;
  private hover = -1;
  private cursor = -1;
  private drag: Drag | null = null;
  private anim: Anim | null = null;
  private promotion: { from: number; to: number; animate: boolean } | null = null;
  private flipAt = -1;
  private time = 0;

  private worker: Worker | null = null;
  private fallback: Searcher | null = null;
  private thinking = false;
  private aiId = 0;
  private aiStarted = 0;
  private aiMove: { move: number; at: number } | null = null;
  /** Último pedido feito ao computador (só para leitura dos testes). */
  private lastAiRequest: AiRequest | null = null;
  private aiRequests = 0;

  private lastHud = '';

  constructor(
    assets: Assets,
    private readonly settings: Settings,
    private readonly onHud: (hud: HudState) => void,
  ) {
    this.sprites = upscaleAll(assets);
    this.worker = this.createWorker();
    this.restart();
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.aiId++;
  }

  // ------------------------------------------------------------------ partida

  restart() {
    this.cancelAi();
    const s = this.settings;
    this.startFen = START_FEN;
    this.pos = Position.fromFen(START_FEN);
    this.legal = this.pos.legalMoves();
    this.sans = [];
    this.ucis = [];
    this.captures = [];
    this.outcome = null;
    this.selected = -1;
    this.drag = null;
    this.anim = null;
    this.promotion = null;
    this.flipAt = -1;
    if (s.mode === 'pvc') {
      this.humanColor = s.color === 'black' ? BLACK : s.color === 'white' ? WHITE : Math.random() < 0.5 ? WHITE : BLACK;
      const you = s.names[0].trim() || 'Você';
      const cpu = `Computador ${s.level}`;
      this.names = this.humanColor === WHITE ? [you, cpu] : [cpu, you];
      this.bottom = this.humanColor;
    } else {
      this.humanColor = null;
      this.names = [s.names[0].trim() || 'Jogador 1', s.names[1].trim() || 'Jogador 2'];
      this.bottom = WHITE;
    }
    this.emit();
  }

  canUndo(): boolean {
    if (this.outcome?.kind === 'resign') return true;
    const plies = this.pos.plyCount;
    if (this.humanColor === null) return plies > 0;
    return plies >= (this.humanColor === WHITE ? 1 : 2);
  }

  /** Volta o último lance (contra o computador, volta até ser a sua vez de novo). */
  undo() {
    if (!this.canUndo()) return;
    this.cancelAi();
    this.anim = null;
    this.drag = null;
    this.promotion = null;
    this.selected = -1;
    if (this.outcome?.kind === 'resign') {
      this.outcome = null;
      this.emit();
      return;
    }
    const pop = () => {
      this.pos.unmake();
      this.sans.pop();
      this.ucis.pop();
      this.captures.pop();
    };
    pop();
    if (this.humanColor !== null) while (this.pos.plyCount > 0 && this.pos.turn !== this.humanColor) pop();
    this.legal = this.pos.legalMoves();
    this.outcome = gameOutcome(this.pos, this.legal);
    if (this.humanColor === null && this.settings.autoFlip) this.bottom = this.pos.turn;
    this.emit();
  }

  flip() {
    this.bottom = (this.bottom ^ 1) as Color;
    this.flipAt = -1;
    this.emit();
  }

  /** Desiste: contra o computador quem desiste é você; a dois, quem está com a vez. */
  resign() {
    if (this.outcome) return;
    this.cancelAi();
    this.promotion = null;
    this.selected = -1;
    const loser = this.humanColor ?? this.pos.turn;
    this.outcome = { kind: 'resign', winner: (loser ^ 1) as Color };
    if (this.humanColor !== null) sfx.lose();
    else sfx.win();
    this.emit();
  }

  choosePromotion(type: number) {
    const p = this.promotion;
    if (!p) return;
    const m = this.legal.find((x) => moveFrom(x) === p.from && moveTo(x) === p.to && movePromo(x) === type);
    this.promotion = null;
    if (m) this.applyMove(m, p.animate);
    this.emit();
  }

  cancelPromotion() {
    this.promotion = null;
    this.selected = -1;
    this.emit();
  }

  private isHumanTurn(): boolean {
    if (this.outcome || this.promotion || this.anim || this.thinking || this.aiMove) return false;
    return this.humanColor === null || this.pos.turn === this.humanColor;
  }

  private applyMove(m: number, animate: boolean) {
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const b = this.pos.board;
    const piece = b[from];
    const capturedSq = flags & FLAG_EP ? to + (colorOf(piece) === WHITE ? -16 : 16) : to;
    const captured = b[capturedSq];
    let rook: Anim['rook'] = null;
    if (flags & FLAG_CASTLE) {
      const rank = rankOf(from);
      const [rf, rt] = fileOf(to) === 6 ? [square(7, rank), square(5, rank)] : [square(0, rank), square(3, rank)];
      rook = { piece: b[rf], from: rf, to: rt };
    }

    this.sans.push(moveToSan(this.pos, m, this.legal));
    this.ucis.push(moveToUci(m));
    this.pos.make(m);
    this.captures.push(this.pos.lastCaptured());
    this.legal = this.pos.legalMoves();
    this.outcome = gameOutcome(this.pos, this.legal);
    this.selected = -1;
    this.anim = animate ? { piece, from, to, t: 0, captured, capturedSq, rook } : null;
    if (this.humanColor === null && this.settings.autoFlip && !this.outcome) this.flipAt = this.time + MOVE_ANIM_S + 0.35;

    if (flags & FLAG_CASTLE) sfx.castle();
    else if (flags & FLAG_CAPTURE) sfx.capture();
    else sfx.move();
    const o = this.outcome;
    if (o) {
      if (o.kind === 'checkmate') {
        if (this.humanColor === null || o.winner === this.humanColor) sfx.win();
        else sfx.lose();
      } else sfx.draw();
    } else if (this.pos.inCheck()) sfx.check();
    this.emit();
  }

  private tryMove(from: number, to: number, animate: boolean): boolean {
    const cands = this.legal.filter((m) => moveFrom(m) === from && moveTo(m) === to);
    if (!cands.length) return false;
    if (cands.length > 1) {
      this.promotion = { from, to, animate };
      this.emit();
    } else this.applyMove(cands[0], animate);
    return true;
  }

  private isTarget(sq: number): boolean {
    return this.selected >= 0 && this.legal.some((m) => moveFrom(m) === this.selected && moveTo(m) === sq);
  }

  private ownPiece(sq: number): boolean {
    const pc = this.pos.board[sq];
    return !!pc && colorOf(pc) === this.pos.turn;
  }

  /** Clique/toque (ou Enter no cursor) numa casa. */
  private clickSquare(sq: number) {
    if (!this.isHumanTurn()) return;
    if (this.ownPiece(sq)) {
      this.selected = this.selected === sq ? -1 : sq;
      if (this.selected >= 0) sfx.select();
    } else if (this.selected >= 0) {
      if (!this.tryMove(this.selected, sq, true)) this.selected = -1;
    }
  }

  // ------------------------------------------------------------------ entrada (coordenadas lógicas)

  private squareAt(x: number, y: number): number {
    const col = Math.floor((x - BOARD_X) / SQ);
    const row = Math.floor((y - BOARD_Y) / SQ);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return this.bottom === WHITE ? square(col, 7 - row) : square(7 - col, row);
  }

  private squareXY(sq: number): [number, number] {
    const f = fileOf(sq);
    const r = rankOf(sq);
    const col = this.bottom === WHITE ? f : 7 - f;
    const row = this.bottom === WHITE ? 7 - r : r;
    return [BOARD_X + col * SQ, BOARD_Y + row * SQ];
  }

  pointerDown(x: number, y: number) {
    this.cursor = -1;
    const sq = this.squareAt(x, y);
    if (sq < 0 || !this.isHumanTurn()) return;
    if (this.ownPiece(sq)) {
      const wasSelected = this.selected === sq;
      this.selected = sq;
      if (!wasSelected) sfx.select();
      this.drag = { sq, x, y, moved: false, wasSelected };
    } else this.clickSquare(sq);
  }

  pointerMove(x: number, y: number) {
    this.hover = this.squareAt(x, y);
    const d = this.drag;
    if (!d) return;
    const [sx, sy] = this.squareXY(d.sq);
    if (!d.moved && Math.hypot(x - (sx + SQ / 2), y - (sy + SQ / 2)) > DRAG_THRESHOLD + SQ / 2) d.moved = true;
    d.x = x;
    d.y = y;
  }

  pointerUp(x: number, y: number) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const to = this.squareAt(x, y);
    if (d.moved) {
      if (to >= 0 && to !== d.sq && !this.tryMove(d.sq, to, false)) sfx.illegal();
    } else if (d.wasSelected && to === d.sq) this.selected = -1;
  }

  pointerLeave() {
    this.hover = -1;
  }

  /** Setas movem o cursor, Enter/Espaço jogam, Esc solta a peça. Devolve true se usou a tecla. */
  keyDown(code: string): boolean {
    const dirs: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (dirs[code]) {
      if (this.cursor < 0) this.cursor = this.selected >= 0 ? this.selected : this.pos.kings[this.pos.turn];
      else {
        const sign = this.bottom === WHITE ? 1 : -1;
        const f = Math.max(0, Math.min(7, fileOf(this.cursor) + dirs[code][0] * sign));
        const r = Math.max(0, Math.min(7, rankOf(this.cursor) + dirs[code][1] * sign));
        this.cursor = square(f, r);
      }
      return true;
    }
    if ((code === 'Enter' || code === 'Space') && this.cursor >= 0) {
      this.clickSquare(this.cursor);
      return true;
    }
    if (code === 'Escape' && this.selected >= 0) {
      this.selected = -1;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ computador

  private createWorker(): Worker | null {
    try {
      const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<AiResponse>) => this.onAiMove(e.data);
      w.onerror = () => {
        // sem worker (navegador antigo, erro de carga): passa a pensar na própria thread
        w.terminate();
        if (this.worker === w) this.worker = null;
        if (this.thinking) {
          this.thinking = false;
          this.aiId++;
        }
      };
      return w;
    } catch {
      return null;
    }
  }

  private requestAi() {
    this.thinking = true;
    this.aiStarted = performance.now();
    const req: AiRequest = { id: ++this.aiId, fen: this.startFen, moves: [...this.ucis], level: this.settings.level };
    if (isE2E()) {
      // testes: sorteio com semente (a mesma para a mesma posição) e busca por nós, não por tempo
      req.seed = ((E2E_SEED_BASE ?? 0) ^ Math.imul(this.pos.plyCount + 1, 0x9e3779b1)) >>> 0;
      req.nodeBudget = Math.round(levelProfile(req.level).timeMs * E2E_NODES_PER_MS);
    }
    this.lastAiRequest = req;
    this.aiRequests++;
    if (this.worker) {
      this.worker.postMessage(req);
      return;
    }
    setTimeout(() => {
      if (req.id !== this.aiId) return;
      this.fallback ??= new Searcher();
      const m = this.fallback.choose(this.pos, req.level, req.seed === undefined ? Math.random : seededRandom(req.seed), req.nodeBudget);
      this.onAiMove({ id: req.id, move: m ? moveToUci(m) : '' });
    }, 30);
  }

  private onAiMove(res: AiResponse) {
    if (res.id !== this.aiId || !this.thinking) return;
    const move = uciToMove(this.pos, res.move);
    this.thinking = false;
    if (!move) return;
    this.aiMove = { move, at: Math.max(performance.now(), this.aiStarted + AI_MIN_DELAY_MS) };
  }

  private cancelAi() {
    this.aiId++;
    this.aiMove = null;
    if (this.thinking && this.worker) {
      // o worker não para no meio da busca: troca por um novo
      this.worker.terminate();
      this.worker = this.createWorker();
    }
    this.thinking = false;
  }

  // ------------------------------------------------------------------ laço

  update(dt: number) {
    this.time += dt;
    if (this.anim) {
      this.anim.t += dt / MOVE_ANIM_S;
      if (this.anim.t >= 1) this.anim = null;
    }
    if (this.flipAt >= 0 && this.time >= this.flipAt && !this.anim) {
      this.flipAt = -1;
      if (!this.outcome) this.bottom = this.pos.turn;
    }
    if (this.aiMove && performance.now() >= this.aiMove.at) {
      const m = this.aiMove.move;
      this.aiMove = null;
      this.applyMove(m, true);
    }
    const aiTurn = this.humanColor !== null && this.pos.turn !== this.humanColor;
    if (aiTurn && !this.outcome && !this.anim && !this.thinking && !this.aiMove) this.requestAi();
    this.emit();
  }

  private emit() {
    const hud: HudState = {
      turn: this.pos.turn,
      moves: this.sans,
      outcome: this.outcome,
      check: !this.outcome && this.pos.inCheck(),
      thinking: this.thinking || !!this.aiMove,
      promotion: this.promotion ? this.pos.turn : null,
      canUndo: this.canUndo(),
      bottom: this.bottom,
      humanColor: this.humanColor,
      names: this.names,
    };
    const key = JSON.stringify(hud);
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.onHud({ ...hud, moves: [...this.sans] });
  }

  // ------------------------------------------------------------------ testes de ponta a ponta (e2eHook.ts)

  /** Retrato do estado para o gancho dos testes (só leitura; nada aqui é o objeto vivo). */
  e2eState(): XadrezE2EState {
    const side = (c: Color | null) => (c === null ? null : c === WHITE ? 'w' : 'b');
    const sq = (n: number) => (n >= 0 ? squareName(n) : null);
    const req = this.lastAiRequest;
    return {
      mode: this.settings.mode,
      level: this.settings.level,
      autoFlip: this.settings.autoFlip,
      fen: this.pos.fen(),
      startFen: this.startFen,
      moves: [...this.sans],
      ucis: [...this.ucis],
      plies: this.pos.plyCount,
      turn: side(this.pos.turn)!,
      check: !this.outcome && this.pos.inCheck(),
      outcome: this.outcome ? { ...this.outcome } : null,
      selected: sq(this.selected),
      cursor: sq(this.cursor),
      dragging: !!this.drag?.moved,
      bottom: side(this.bottom)!,
      humanColor: side(this.humanColor),
      names: [...this.names],
      thinking: this.thinking,
      aiPending: !!this.aiMove,
      animating: !!this.anim,
      flipPending: this.flipAt >= 0,
      promotion: this.promotion ? { color: side(this.pos.turn)!, from: squareName(this.promotion.from), to: squareName(this.promotion.to) } : null,
      canUndo: this.canUndo(),
      humanTurn: this.isHumanTurn(),
      legalTargets: this.selected >= 0 ? this.legal.filter((m) => moveFrom(m) === this.selected).map((m) => squareName(moveTo(m))) : [],
      worker: !!this.worker,
      aiRequests: this.aiRequests,
      lastAiRequest: req ? { ...req, moves: [...req.moves] } : null,
    };
  }

  /** Centro de cada casa (\`a1\`..\`h8\`) em coordenadas lógicas, respeitando o giro do tabuleiro. */
  e2eTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const [x, y] = this.squareXY(square(f, r));
        out[squareName(square(f, r))] = { x: x + SQ / 2, y: y + SQ / 2 };
      }
    }
    return out;
  }

  /** Pré-condição rara dos testes: troca a posição atual por \`fen\` (partida nova a partir dela). */
  e2eSetFen(fen: string) {
    this.cancelAi();
    this.startFen = fen;
    this.pos = Position.fromFen(fen);
    this.legal = this.pos.legalMoves();
    this.sans = [];
    this.ucis = [];
    this.captures = [];
    this.outcome = gameOutcome(this.pos, this.legal);
    this.selected = -1;
    this.cursor = -1;
    this.drag = null;
    this.anim = null;
    this.promotion = null;
    this.flipAt = -1;
    this.emit();
  }

  // ------------------------------------------------------------------ desenho

  render(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    blit(ctx, this.sprites.fundo, 0, 0);
    this.drawCoords(ctx);
    this.drawHighlights(ctx);
    this.drawPieces(ctx);
    this.drawTargets(ctx);
    this.drawMoving(ctx);
    this.drawPanel(ctx);
  }

  private fillSquare(ctx: CanvasRenderingContext2D, sq: number, color: string) {
    const [x, y] = this.squareXY(sq);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, SQ, SQ);
  }

  private frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y + 1, 1, h - 2);
    ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  }

  private drawPiece(ctx: CanvasRenderingContext2D, piece: number, x: number, y: number) {
    const img = this.sprites[pieceKey(colorOf(piece), typeOf(piece))];
    blit(ctx, img, Math.round(x * SCALE) / SCALE, Math.round(y * SCALE) / SCALE);
  }

  private drawCoords(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < 8; i++) {
      const file = this.bottom === WHITE ? i : 7 - i;
      const rank = this.bottom === WHITE ? 7 - i : i;
      drawPixelText(ctx, String.fromCharCode(65 + file), BOARD_X + i * SQ + 10, BOARD_Y + 8 * SQ + 2, COLOR_MUTED, 1, null);
      drawPixelText(ctx, String(rank + 1), BOARD_X - 6, BOARD_Y + i * SQ + 9, COLOR_MUTED, 1, null);
    }
  }

  private drawHighlights(ctx: CanvasRenderingContext2D) {
    const last = this.pos.lastMove();
    if (last) {
      this.fillSquare(ctx, moveFrom(last), 'rgba(255, 211, 107, 0.32)');
      this.fillSquare(ctx, moveTo(last), 'rgba(255, 211, 107, 0.42)');
    }
    if (this.selected >= 0) this.fillSquare(ctx, this.selected, 'rgba(95, 209, 122, 0.5)');
    const checked = this.outcome?.kind === 'checkmate' ? this.pos.turn : this.pos.inCheck() ? this.pos.turn : -1;
    if (checked >= 0 && !this.anim) {
      const k = this.pos.kings[checked];
      this.fillSquare(ctx, k, 'rgba(255, 77, 94, 0.55)');
      const [x, y] = this.squareXY(k);
      this.frame(ctx, x, y, SQ, SQ, COLOR_RED);
    }
  }

  private drawPieces(ctx: CanvasRenderingContext2D) {
    const a = this.anim;
    const b = this.pos.board;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = square(f, r);
        const pc = b[sq];
        if (!pc) continue;
        if (a && (sq === a.to || sq === a.rook?.to)) continue;
        const [x, y] = this.squareXY(sq);
        if (this.drag?.moved && sq === this.drag.sq) ctx.globalAlpha = 0.35;
        this.drawPiece(ctx, pc, x + 1, y + 1);
        ctx.globalAlpha = 1;
      }
    }
    if (a && a.captured) {
      const [x, y] = this.squareXY(a.capturedSq);
      this.drawPiece(ctx, a.captured, x + 1, y + 1);
    }
  }

  private drawTargets(ctx: CanvasRenderingContext2D) {
    if (this.selected >= 0 && this.isHumanTurn()) {
      for (const m of this.legal) {
        if (moveFrom(m) !== this.selected || (movePromo(m) && movePromo(m) !== QUEEN)) continue;
        const [x, y] = this.squareXY(moveTo(m));
        if (moveFlags(m) & FLAG_CAPTURE) {
          ctx.fillStyle = 'rgba(255, 77, 94, 0.85)';
          for (let i = 0; i < 4; i++) {
            const w = 4 - i;
            ctx.fillRect(x, y + i, w, 1);
            ctx.fillRect(x + SQ - w, y + i, w, 1);
            ctx.fillRect(x, y + SQ - 1 - i, w, 1);
            ctx.fillRect(x + SQ - w, y + SQ - 1 - i, w, 1);
          }
        } else {
          const cx = x + SQ / 2;
          const cy = y + SQ / 2;
          ctx.fillStyle = 'rgba(27, 18, 32, 0.5)';
          ctx.fillRect(cx - 3, cy - 2, 6, 4);
          ctx.fillRect(cx - 2, cy - 3, 4, 1);
          ctx.fillRect(cx - 2, cy + 2, 4, 1);
        }
      }
    }
    if (this.hover >= 0 && !this.drag && this.isHumanTurn() && (this.ownPiece(this.hover) || this.isTarget(this.hover))) {
      const [x, y] = this.squareXY(this.hover);
      this.frame(ctx, x, y, SQ, SQ, 'rgba(244, 239, 226, 0.7)');
    }
    if (this.drag?.moved) {
      const to = this.squareAt(this.drag.x, this.drag.y);
      if (to >= 0 && this.isTarget(to)) {
        const [x, y] = this.squareXY(to);
        this.frame(ctx, x, y, SQ, SQ, COLOR_TEXT);
      }
    }
    if (this.cursor >= 0) {
      const [x, y] = this.squareXY(this.cursor);
      const blink = Math.floor(this.time * 3) % 2 === 0;
      this.frame(ctx, x, y, SQ, SQ, blink ? COLOR_ACCENT : '#b8892f');
      this.frame(ctx, x + 1, y + 1, SQ - 2, SQ - 2, blink ? COLOR_ACCENT : '#b8892f');
    }
  }

  private drawMoving(ctx: CanvasRenderingContext2D) {
    const a = this.anim;
    if (a) {
      const e = 1 - (1 - Math.min(1, a.t)) ** 2;
      const lerp = (from: number, to: number) => {
        const [x0, y0] = this.squareXY(from);
        const [x1, y1] = this.squareXY(to);
        return [x0 + (x1 - x0) * e + 1, y0 + (y1 - y0) * e + 1];
      };
      if (a.rook) {
        const [rx, ry] = lerp(a.rook.from, a.rook.to);
        this.drawPiece(ctx, a.rook.piece, rx, ry);
      }
      const [x, y] = lerp(a.from, a.to);
      this.drawPiece(ctx, a.piece, x, y);
    }
    const d = this.drag;
    if (d?.moved) this.drawPiece(ctx, this.pos.board[d.sq], d.x - 10, d.y - 13);
  }

  private drawPanel(ctx: CanvasRenderingContext2D) {
    this.drawSide(ctx, (this.bottom ^ 1) as Color, BOX_TOP_Y);
    this.drawSide(ctx, this.bottom, BOX_BOTTOM_Y);

    let text: string;
    let color = COLOR_TEXT;
    const o = this.outcome;
    if (o) {
      color = COLOR_ACCENT;
      text = {
        checkmate: 'XEQUE-MATE!',
        resign: 'DESISTENCIA',
        stalemate: 'AFOGADO - EMPATE',
        fifty: '50 LANCES - EMPATE',
        repetition: 'REPETICAO - EMPATE',
        material: 'SEM MATE - EMPATE',
      }[o.kind];
    } else if (this.promotion) {
      text = 'ESCOLHA A PECA';
      color = COLOR_ACCENT;
    } else if (this.thinking || this.aiMove) {
      text = 'PENSANDO' + '.'.repeat(Math.floor(this.time * 3) % 4);
      color = COLOR_MUTED;
    } else if (this.pos.inCheck()) {
      text = 'XEQUE!';
      color = Math.floor(this.time * 4) % 2 ? COLOR_RED : COLOR_TEXT;
    } else text = this.pos.turn === WHITE ? 'VEZ DAS BRANCAS' : 'VEZ DAS PRETAS';
    const x = PANEL_X + Math.round((PANEL_W - textWidth(text)) / 2);
    drawPixelText(ctx, text, x, STATUS_Y + Math.round((STATUS_H - 5) / 2), color);
  }

  /** Caixa de um lado: nome, vez de jogar, peças que ele já capturou e vantagem de material. */
  private drawSide(ctx: CanvasRenderingContext2D, color: Color, y: number) {
    const active = !this.outcome && this.pos.turn === color;
    const won = this.outcome && 'winner' in this.outcome && this.outcome.winner === color;
    if (active || won) this.frame(ctx, PANEL_X, y, PANEL_W, BOX_H, COLOR_ACCENT);
    this.drawMini(ctx, color, KING, PANEL_X + 3, y + 2);
    const name = plain(this.names[color]).slice(0, 17);
    drawPixelText(ctx, name, PANEL_X + 15, y + 6, active || won ? COLOR_ACCENT : COLOR_TEXT);

    let material = 0;
    const b = this.pos.board;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88 || !b[sq]) continue;
      material += (colorOf(b[sq]) === color ? 1 : -1) * POINTS[typeOf(b[sq])];
    }
    if (material > 0) {
      const t = `+${material}`;
      drawPixelText(ctx, t, PANEL_X + PANEL_W - 4 - textWidth(t), y + 6, '#5fd17a');
    }

    const taken = this.captures.filter((pc) => pc && colorOf(pc) !== color).sort((p, q) => CAPTURE_ORDER[typeOf(p)] - CAPTURE_ORDER[typeOf(q)]);
    taken.forEach((pc, i) => {
      const row = Math.floor(i / CAPTURED_PER_ROW);
      if (row > 1) return;
      this.drawMini(ctx, colorOf(pc), typeOf(pc), PANEL_X + 4 + (i % CAPTURED_PER_ROW) * 11, y + 15 + row * 11);
    });
  }

  /** Peça mini do painel; as pretas ganham uma placa clara para não sumir no fundo escuro. */
  private drawMini(ctx: CanvasRenderingContext2D, color: Color, type: number, x: number, y: number) {
    if (color === BLACK) {
      ctx.fillStyle = '#5a5168';
      ctx.fillRect(x, y + 1, 10, 9);
      ctx.fillRect(x + 1, y, 8, 11);
    }
    blit(ctx, this.sprites[pieceKey(color, type, true)], x, y);
  }
}
