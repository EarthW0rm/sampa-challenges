/**
 * Piloto do Xadrez (plan.md 4.3): o `Searcher` do jogo, do lado do Node, com semente e orçamento de nós
 * fixos, decide o lance a partir da posição lida pelo gancho; o lance vira gestos reais (toque na peça,
 * toque na casa, botão da promoção). Enquanto o computador pensa, o piloto espera em tempo real sem
 * rodar quadros (a busca do worker não depende dos quadros).
 */
import { gameOutcome, moveToSan, type Outcome, Position, uciToMove } from '../../../src/games/xadrez-paulistano/game/chess';
import type { Gesture, Strategy } from '../../support/pilot';
import { FPS } from '../../support/game-page';
import { NodeBrain } from './brain';
import { ANIM_FRAMES, type XadrezPage, type XState } from './page';

/** Nível do piloto (spec: nível 85 com semente fixa). */
export const PILOT_LEVEL = 85;
/** Orçamento de nós de cada lance do piloto (fixo: o piloto não depende da máquina nem do tempo). */
export const PILOT_NODES = 30_000;
/** Limite de lances (de cada lado) da partida: passou disso sem resultado = `travou`. */
export const MAX_MOVES = 200;
/** Teto de quadros por partida: 30 min de jogo. */
export const MAX_FRAMES = 30 * 60 * FPS;

const PROMO: Record<string, string> = { q: 'Dama', r: 'Torre', b: 'Bispo', n: 'Cavalo' };

/** Resultado e notação recalculados no Node a partir dos lances UCI da partida. */
export function recompute(startFen: string, ucis: string[]): { outcome: Outcome | null; sans: string[] } {
  const pos = Position.fromFen(startFen);
  const sans: string[] = [];
  let legal = pos.legalMoves();
  for (const u of ucis) {
    const m = uciToMove(pos, u);
    if (!m) throw new Error(`lance ilegal na partida: ${u}`);
    sans.push(moveToSan(pos, m, legal));
    pos.make(m);
    legal = pos.legalMoves();
  }
  return { outcome: gameOutcome(pos, legal), sans };
}

export function xadrezStrategy(seed: number): Strategy<XState, XadrezPage> {
  const brain = new NodeBrain(PILOT_LEVEL, PILOT_NODES, seed);
  let plan: string | null = null;
  return {
    name: 'xadrez',
    async read(game) {
      // computador pensando: espera a resposta do worker em tempo real, sem rodar quadros
      await game.page.waitForFunction(
        () => {
          const h = (window as unknown as { __e2e?: { api: { state(): { thinking: boolean } } } | null }).__e2e;
          return !h || !h.api.state().thinking;
        },
        undefined,
        { polling: 20, timeout: 60_000 },
      );
      return game.state();
    },
    decide(s): Gesture | null {
      if (s.ucis.length >= MAX_MOVES * 2) return { kind: 'wait', frames: MAX_FRAMES, target: 'limite de lances' };
      if (s.promotion) {
        const label = PROMO[plan?.[4] ?? 'q'];
        return { kind: 'click', selector: `.xadrez-paulistano [role=dialog] button:has-text("${label}")`, frames: ANIM_FRAMES, target: `promoção ${label}` };
      }
      if (!s.humanTurn) return null;
      const squares = s.squares;
      if (plan && s.selected === plan.slice(0, 2)) {
        const to = plan.slice(2, 4);
        return { kind: 'tap', ...squares[to], frames: ANIM_FRAMES, target: `casa ${to}` };
      }
      plan = brain.choose(s.startFen, s.ucis);
      const from = plan.slice(0, 2);
      return { kind: 'tap', ...squares[from], frames: 1, target: `peça ${from}` };
    },
    over: (s) => !!s.outcome,
    result: (s) => {
      const r = recompute(s.startFen, s.ucis);
      return { exibido: s.outcome, recalculado: r.outcome, lances: s.moves, lancesRecalculados: r.sans, uci: s.ucis };
    },
  };
}
