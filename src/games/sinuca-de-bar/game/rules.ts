import { BALL_R, CY, FOOT_X } from './constants';
import type { Ball, ShotEvents } from './physics';

/**
 * Regras da sinuca de bar em TypeScript puro: grupos, faltas, vez, bola na mão e a bola castigo.
 * `resolveShot` recebe o estado antes da tacada e o que aconteceu na mesa e devolve o estado novo.
 */

/** Lisas × listradas (bola 8 decide) ou ímpares × pares (bola 15 decide). */
export type RuleSet = 'lisas' | 'parimpar';
/** Grupo A = lisas / ímpares; grupo B = listradas / pares. */
export type Group = 'A' | 'B';

export interface RuleInfo {
  castigo: number;
  names: Record<Group, string>;
  /** Nome no singular para frases ("bola lisa"). */
  short: Record<Group, string>;
}

export const RULES: Record<RuleSet, RuleInfo> = {
  lisas: { castigo: 8, names: { A: 'Lisas', B: 'Listradas' }, short: { A: 'lisa', B: 'listrada' } },
  parimpar: { castigo: 15, names: { A: 'Ímpares', B: 'Pares' }, short: { A: 'ímpar', B: 'par' } },
};

export function groupOf(n: number, rs: RuleSet): Group | null {
  if (n === 0 || n === RULES[rs].castigo) return null;
  if (rs === 'lisas') return n < 8 ? 'A' : 'B';
  return n % 2 === 1 ? 'A' : 'B';
}

export const other = (g: Group): Group => (g === 'A' ? 'B' : 'A');

/** Bolas do grupo ainda na mesa. */
export function remaining(balls: readonly Ball[], g: Group, rs: RuleSet): number[] {
  return balls.filter((b) => b.on && groupOf(b.n, rs) === g).map((b) => b.n);
}

export type BallInHand = 'kitchen' | 'anywhere' | null;

export interface MatchState {
  rules: RuleSet;
  /** Jogador da vez (0 ou 1). */
  turn: 0 | 1;
  /** Grupo de cada jogador (null = mesa aberta). */
  groups: [Group | null, Group | null];
  /** A próxima tacada é a saída. */
  isBreak: boolean;
  ballInHand: BallInHand;
  winner: 0 | 1 | null;
  /** Por que a partida acabou. */
  endReason: string | null;
}

export function newMatch(rules: RuleSet, breaker: 0 | 1): MatchState {
  return { rules, turn: breaker, groups: [null, null], isBreak: true, ballInHand: 'kitchen', winner: null, endReason: null };
}

/** O jogador já limpou o grupo dele e agora joga na bola castigo. */
export function onCastigo(s: MatchState, balls: readonly Ball[], p: 0 | 1): boolean {
  const g = s.groups[p];
  return g !== null && remaining(balls, g, s.rules).length === 0;
}

/** Bolas que o jogador da vez pode tocar primeiro. */
export function legalTargets(s: MatchState, balls: readonly Ball[]): number[] {
  const { castigo } = RULES[s.rules];
  const g = s.groups[s.turn];
  const on = balls.filter((b) => b.on && b.n !== 0);
  if (g === null) return on.filter((b) => b.n !== castigo).map((b) => b.n);
  if (onCastigo(s, balls, s.turn)) return [castigo];
  return on.filter((b) => groupOf(b.n, s.rules) === g).map((b) => b.n);
}

export interface ShotResult {
  state: MatchState;
  foul: string | null;
  /** O jogador continua na mesa. */
  again: boolean;
  /** Avisos para mostrar na mesa (o motor tira os acentos para a fonte do canvas). */
  messages: string[];
  /** Grupo que o jogador da vez ganhou nesta tacada (a mesa estava aberta). */
  assigned: Group | null;
  /** A bola castigo caiu na saída e volta para a marca do pé. */
  respotCastigo: boolean;
  /** A branca caiu e precisa voltar (bola na mão). */
  respotCue: boolean;
}

/** Decide a tacada. `before` = bolas como estavam antes da tacada; `ev` = o que aconteceu. */
export function resolveShot(s: MatchState, before: readonly Ball[], ev: ShotEvents): ShotResult {
  const rs = s.rules;
  const { castigo } = RULES[rs];
  const p = s.turn;
  const opp = (p ^ 1) as 0 | 1;
  const myGroup = s.groups[p];
  const wasOnCastigo = onCastigo(s, before, p);
  const cueIn = ev.pocketed.includes(0);
  const castigoIn = ev.pocketed.includes(castigo);
  const objectIn = ev.pocketed.filter((n) => n !== 0 && n !== castigo);
  const messages: string[] = [];
  const next: MatchState = { ...s, groups: [...s.groups] as MatchState['groups'], isBreak: false, ballInHand: null };

  // ---------------------------------------------------------------- faltas
  let foul: string | null = null;
  const first = ev.firstHit;
  if (first === null) foul = 'Não tocou em nenhuma bola';
  else if (myGroup === null) {
    if (first === castigo && !s.isBreak) foul = `Tocou primeiro na bola ${castigo}`;
  } else if (wasOnCastigo) {
    if (first !== castigo) foul = `Tinha que tocar primeiro na bola ${castigo}`;
  } else if (first === castigo) foul = `Tocou primeiro na bola ${castigo}`;
  else if (groupOf(first, rs) !== myGroup) foul = 'Tocou primeiro na bola do adversário';
  if (cueIn) foul = foul ? `A branca caiu e ${foul.charAt(0).toLowerCase()}${foul.slice(1)}` : 'A branca caiu';

  // ---------------------------------------------------------------- bola castigo
  let respotCastigo = false;
  if (castigoIn) {
    if (s.isBreak) {
      respotCastigo = true;
      messages.push(`Bola ${castigo} na saída: volta para a marca`);
    } else if (wasOnCastigo && !foul) {
      next.winner = p;
      next.endReason = `Encaçapou a bola ${castigo}.`;
    } else {
      next.winner = opp;
      if (cueIn) next.endReason = `Derrubou a branca junto com a bola ${castigo}.`;
      else if (!wasOnCastigo) next.endReason = `Encaçapou a bola ${castigo} antes da hora.`;
      else next.endReason = `Falta na bola ${castigo}: ${foul!.toLowerCase()}.`;
    }
  }
  if (next.winner !== null) {
    return { state: next, foul, again: false, messages, assigned: null, respotCastigo: false, respotCue: false };
  }

  // ---------------------------------------------------------------- grupos (mesa aberta)
  let assigned: Group | null = null;
  if (myGroup === null && !foul && objectIn.length) {
    const g = groupOf(objectIn[0], rs)!;
    assigned = g;
    next.groups[p] = g;
    next.groups[opp] = other(g);
  }

  // ---------------------------------------------------------------- vez
  const g = next.groups[p];
  const own = g ? objectIn.filter((n) => groupOf(n, rs) === g).length : 0;
  const again = !foul && (s.isBreak ? objectIn.length > 0 : own > 0);
  if (foul) {
    messages.unshift(`Falta: ${foul}`);
    next.turn = opp;
    next.ballInHand = 'anywhere';
  } else if (!again) {
    next.turn = opp;
  }
  return { state: next, foul, again, messages, assigned, respotCastigo, respotCue: cueIn };
}

/** Lugar livre mais perto da marca do pé, andando para a direita (para recolocar a castigo). */
export function footSpot(balls: readonly Ball[]): { x: number; y: number } {
  for (let x = FOOT_X; x < FOOT_X + 80; x += 0.5) {
    if (balls.every((b) => !b.on || (b.x - x) ** 2 + (b.y - CY) ** 2 >= (2 * BALL_R + 0.2) ** 2)) return { x, y: CY };
  }
  return { x: FOOT_X, y: CY };
}

/**
 * Arma o triângulo com a ponta na marca do pé: castigo no meio da terceira fileira, uma bola de
 * cada grupo nos cantos de trás e as outras sorteadas.
 */
export function rack(rs: RuleSet, rnd: () => number = Math.random): { n: number; x: number; y: number }[] {
  const { castigo } = RULES[rs];
  const a = [] as number[];
  const b = [] as number[];
  for (let n = 1; n <= 15; n++) {
    const g = groupOf(n, rs);
    if (g === 'A') a.push(n);
    else if (g === 'B') b.push(n);
  }
  const shuffle = (xs: number[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  shuffle(a);
  shuffle(b);
  const corners = rnd() < 0.5 ? [a.pop()!, b.pop()!] : [b.pop()!, a.pop()!];
  const rest = shuffle([...a, ...b]);
  const out: { n: number; x: number; y: number }[] = [];
  const gap = 2 * BALL_R + 0.05;
  const dx = gap * Math.cos(Math.PI / 6);
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      let n: number;
      if (row === 2 && i === 1) n = castigo;
      else if (row === 4 && i === 0) n = corners[0];
      else if (row === 4 && i === 4) n = corners[1];
      else n = rest.pop()!;
      out.push({ n, x: FOOT_X + row * dx, y: CY + (i - row / 2) * gap });
    }
  }
  return out;
}
