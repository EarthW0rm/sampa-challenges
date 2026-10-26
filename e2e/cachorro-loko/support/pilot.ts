/**
 * Jogador automático do Cachorro Loko (plan.md 4.3): lê o estado pelo gancho, prevê onde e quando cada
 * pacote não-bomba chega à altura do baú (física do jogo: esteiras, desvios, gravidade) e segura ←/→ por
 * alguns quadros para ficar embaixo do primeiro que vai chegar. Evita ficar sob uma bomba que chega antes.
 */
import {
  BELTS,
  BOX_SIZE,
  CATCH_RECT,
  DOG_FRAME,
  DOG_SPEED,
  DOG_TURBO_SPEED,
  GRAVITY,
  MAX_LIVES,
  POWER_DURATION,
  START_LIVES,
} from '../../../src/games/cachorro-loko/game/constants';
import type { CLBox, CLEvent, CLState } from '../../../src/games/cachorro-loko/game/e2eHook';
import { FPS } from '../../support/game-page';
import type { Gesture, Strategy } from '../../support/pilot';
import type { CachorroLokoPage } from './page';

export interface PilotView {
  s: CLState;
  events: CLEvent[];
}

/** Teto de quadros de uma partida: 20 min de jogo (média ≈ 107 s; plan.md 4.3). */
export const MAX_FRAMES = 20 * 60 * FPS;

/** Quadros por decisão quando não há o que fazer. */
export const DECIDE_EVERY = 3;

/** Velocidade média do arremesso para a rua (18 a 28 px/s). */
const STREET_VX = 23;

interface Arrival {
  t: number;
  /** Centro x do pacote quando o fundo dele chega ao topo da área de pega. */
  cx: number;
  bomb: boolean;
}

/** Tempo até o pacote em queda livre (y, vy) chegar a `yTarget`. */
function fallTime(y: number, vy: number, yTarget: number): number {
  const d = yTarget - y;
  if (d <= 0) return 0;
  // y + vy t + g t²/2 = yTarget
  const a = GRAVITY / 2;
  return (-vy + Math.sqrt(vy * vy + 4 * a * d)) / (2 * a);
}

/** Previsão de chegada de cada pacote que vai para a rua (os que descem para outra esteira entram depois). */
export function arrivals(s: CLState): Arrival[] {
  const catchTop = s.catchRect.y - BOX_SIZE;
  const out: Arrival[] = [];
  for (const b of s.boxes) {
    if (b.state === 'street') {
      const t = fallTime(b.y, b.vy, catchTop);
      out.push({ t, cx: b.x + b.vx * t + BOX_SIZE / 2, bomb: b.kind === 'bomba' });
    }
  }
  // esteiras: em cada uma, os pacotes chegam à ponta em ordem e o desvio alterna a cada um
  BELTS.forEach((belt, i) => {
    const on = s.boxes.filter((b: CLBox) => b.state === 'belt' && b.belt === i);
    const dist = (b: CLBox) => (belt.dir > 0 ? belt.x1 - (b.x + BOX_SIZE / 2) : b.x + BOX_SIZE / 2 - belt.x0);
    on.sort((a, b) => dist(a) - dist(b));
    let state = i < s.desvios.length ? s.desvios[i].state : 'rua';
    for (const b of on) {
      const goesStreet = i === BELTS.length - 1 || state === 'rua';
      if (i < s.desvios.length) state = state === 'rua' ? 'desce' : 'rua';
      if (!goesStreet) continue;
      const d = Math.max(0, dist(b));
      const t1 = d / s.beltSpeed;
      const x0 = b.x + belt.dir * d;
      const t2 = fallTime(belt.y - BOX_SIZE, -30, catchTop);
      out.push({ t: t1 + t2, cx: x0 + belt.dir * STREET_VX * t2 + BOX_SIZE / 2, bomb: b.kind === 'bomba' });
    }
  });
  return out.sort((a, b) => a.t - b.t);
}

/** x do cachorro (canto do quadro) que põe o centro da área de pega em `cx`, olhando para `facing`. */
const dogXFor = (cx: number, facing: 1 | -1): number => cx - (facing > 0 ? CATCH_RECT.x : DOG_FRAME - CATCH_RECT.x - CATCH_RECT.w) - CATCH_RECT.w / 2;

export function decide(s: CLState): Gesture | null {
  if (s.phase !== 'playing' || s.dog.dizzy > 0) return null;
  const arr = arrivals(s);
  const speed = (s.powers.turbo > 0 ? DOG_TURBO_SPEED : DOG_SPEED) / FPS;
  const good = arr.filter((a) => !a.bomb);
  // primeiro pacote que ainda dá para alcançar (ou o primeiro de todos, se nenhum dá)
  const reach = (a: Arrival) => Math.abs(dogXFor(a.cx, s.dog.facing) - s.dog.x) / speed / FPS <= a.t + 0.05;
  const target = good.find(reach) ?? good[0];
  if (!target) return null;
  const goalR = dogXFor(target.cx, 1);
  const goalL = dogXFor(target.cx, -1);
  let goal = s.dog.x < goalR ? goalR : s.dog.x > goalL ? goalL : s.dog.x;
  // bomba que chega antes do alvo e cairia no baú na posição final: para um pouco ao lado
  const bomb = arr.find((a) => a.bomb && a.t < target.t + 0.1 && Math.abs(a.cx - (goal + DOG_FRAME / 2)) < CATCH_RECT.w / 2 + BOX_SIZE);
  if (bomb && bomb.t < 0.6) {
    const away = bomb.cx < goal + DOG_FRAME / 2 ? 1 : -1;
    goal = bomb.cx + away * (CATCH_RECT.w / 2 + BOX_SIZE + 2) - DOG_FRAME / 2;
  }
  const dx = goal - s.dog.x;
  const frames = Math.min(Math.round(Math.abs(dx) / speed), 6);
  if (frames < 1) return null;
  return { kind: 'key', key: dx < 0 ? 'ArrowLeft' : 'ArrowRight', frames, target: 'rua' };
}

/** Placar e vidas recalculados só a partir dos eventos da partida (RN-22). */
export function recalc(events: CLEvent[]): { score: number; lives: number; delivered: number; catches: number; lost: number; bombs: number } {
  let score = 0;
  let lives = START_LIVES;
  let delivered = 0;
  let dobroAt: number | null = null;
  let lost = 0;
  let bombs = 0;
  for (const e of events) {
    if (e.ev === 'catch') {
      if (e.kind === 'bomba') {
        lives--;
        bombs++;
        continue;
      }
      const active = dobroAt !== null && e.t - dobroAt < POWER_DURATION.dobro;
      score += active ? 2 : 1;
      delivered++;
      if (e.kind === 'vida') lives = Math.min(MAX_LIVES, lives + 1);
      if (e.kind === 'dobro') dobroAt = e.t;
    } else if (e.ev === 'land' && e.kind !== 'bomba') {
      lives--;
      lost++;
    }
  }
  return { score, lives: Math.max(0, lives), delivered, catches: delivered + bombs, lost, bombs };
}

/** Estratégia para o `runPilot` da base comum. Os eventos são lidos de forma incremental. */
export function cachorroStrategy(): Strategy<PilotView, CachorroLokoPage> {
  const events: CLEvent[] = [];
  let maxLevel = 1;
  return {
    name: 'cachorro-loko',
    async read(game) {
      const s = await game.state();
      if (s.events > events.length) events.push(...(await game.events(events.length)));
      maxLevel = Math.max(maxLevel, s.level);
      return { s, events };
    },
    decide: (v) => decide(v.s),
    over: (v) => v.s.phase === 'over',
    result: (v) => ({ placar: v.s.score, entregas: v.s.delivered, vidas: v.s.lives, nivelMaximo: maxLevel, tempo: +v.s.time.toFixed(3), recalculado: recalc(v.events) }),
  };
}

