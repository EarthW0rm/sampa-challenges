/**
 * Piloto do Capacete Voador (plan.md 4.3): na vez de um humano, busca na grade de ângulo/velocidade com a
 * mesma simulação do jogo (`simulateShot` do gancho) um tiro que acerte o adversário (ou, sem caminho, o
 * que passa mais perto, para abrir cratera) e o executa pela tela: preenche os campos e aperta Enter.
 */
import type { Gesture, Strategy } from '../../support/pilot';
import { MOTO_HP } from '../../../src/games/capacete-voador/game/constants';
import type { PlayerIndex } from '../../../src/games/capacete-voador/game/types';
import type { CapacetePage, CVState } from './page';

export interface PilotState {
  s: CVState;
  /** Tiro planejado para a vez atual (só na mira de um humano). */
  plan: { angle: number; velocity: number; kind: string } | null;
  /** Texto do placar (`a × b`) e do vencedor no diálogo de fim de jogo, se aberto. */
  shown: { score: string; winner: string } | null;
  /** Rodadas a jogar no treino (não tem fim de partida). */
  practiceRounds: number;
}

/** Recalcula o placar a partir dos tiros registrados (quem leva o golpe perde a rodada). */
export function recalc(s: CVState): { scores: [number, number]; rounds: number; practiceHits: number } {
  const scores: [number, number] = [0, 0];
  const dmg = new Map<string, number>();
  let rounds = 0;
  let practiceHits = 0;
  for (const o of s.outcomes) {
    if (o.index === null) continue;
    if (s.mode === 'practice' && o.index === 1) practiceHits++;
    const key = `${o.round}:${o.index}`;
    let over = o.kind === 'pilot';
    if (o.kind === 'moto') {
      dmg.set(key, (dmg.get(key) ?? 0) + 1);
      over = dmg.get(key)! >= MOTO_HP;
    }
    if (over) {
      rounds++;
      scores[o.index === 0 ? 1 : 0]++;
    }
  }
  return { scores, rounds, practiceHits };
}

const human = (s: CVState, p: PlayerIndex) => s.mode === 'pvp' || p === 0;

export function capaceteStrategy(practiceRounds = 3): Strategy<PilotState, CapacetePage> {
  const queue: Gesture[] = [];
  let planned = '';
  return {
    name: 'capacete-voador',
    async read(game) {
      const s = await game.state();
      let plan: PilotState['plan'] = null;
      const key = `${s.round}:${s.shotsFired}:${s.turn}`;
      if (s.phase === 'aiming' && human(s, s.turn) && key !== planned) {
        plan = await game.hook((h) => {
          const st = h.state();
          const me = st.turn;
          const other = me === 0 ? 1 : 0;
          let best: { angle: number; velocity: number; kind: string; score: number } | null = null;
          for (let a = 15; a <= 88; a++) {
            for (let v = 10; v <= 160; v++) {
              const r = h.simulateShot(a, v, me);
              const hit = r.index === other;
              const selfHit = r.index === me;
              // acerto no adversário vale mais; perto dele vem depois; nunca a si mesmo
              const score = selfHit ? -1e9 : hit ? 1e6 - Math.abs(a - 45) : -r.minDist;
              if (!best || score > best.score) best = { angle: a, velocity: v, kind: r.kind, score };
            }
          }
          return { angle: best!.angle, velocity: best!.velocity, kind: best!.kind };
        });
      }
      const shown = await game.page.evaluate(() => {
        const d = document.querySelector('.capacete-voador .overlay-box');
        if (!d) return null;
        return { score: (d.querySelector('p')?.textContent ?? '').trim(), winner: (d.querySelector('h2')?.textContent ?? '').trim() };
      });
      return { s, plan, shown, practiceRounds };
    },
    decide(st) {
      const { s, plan } = st;
      if (plan) {
        planned = `${s.round}:${s.shotsFired}:${s.turn}`;
        const side = s.turn === 0 ? 'left' : 'right';
        const form = `.capacete-voador .player-panel.${side} .aim-form input`;
        queue.push(
          { kind: 'fill', selector: `${form} >> nth=0`, value: String(plan.angle), target: `ângulo J${s.turn + 1}` },
          { kind: 'fill', selector: `${form} >> nth=1`, value: String(plan.velocity), target: `velocidade J${s.turn + 1}` },
          { kind: 'key', key: 'Enter', frames: 0, target: `lançar J${s.turn + 1}` },
        );
      }
      return queue.shift() ?? { kind: 'wait', frames: 30, target: 'esperar o jogo' };
    },
    over(st) {
      if (st.s.mode === 'practice') return st.s.round > st.practiceRounds && st.s.phase === 'aiming';
      return st.s.phase === 'gameOver' && st.shown !== null;
    },
    result(st) {
      const r = recalc(st.s);
      return {
        modo: st.s.mode,
        dificuldade: st.s.difficulty,
        rodadas: st.s.round,
        placarJogo: st.s.scores,
        placarRecalculado: r.scores,
        placarExibido: st.shown?.score ?? null,
        vencedorExibido: st.shown?.winner ?? null,
        tiros: st.s.shotsFired,
        treino: st.s.mode === 'practice' ? { tiros: st.s.practiceShots, acertos: st.s.practiceHits, acertosRecalculados: r.practiceHits, rodadasEncerradas: r.rounds } : null,
      };
    },
  };
}
