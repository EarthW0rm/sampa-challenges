import { riderBounds, simulate, type World } from './physics';
import type { Difficulty, PlayerIndex, Point, Shot } from './types';

type Rng = () => number;

interface Candidate {
  shot: Shot;
  minDist: number;
}

interface Survey {
  /** Tiros que acertam o adversário (moto ou piloto). */
  hits: Shot[];
  /** Só os que acertam o piloto: vitória direta. */
  pilotHits: Shot[];
  closest: Candidate;
}

const ANGLE_RANGE: [number, number] = [15, 88];
const VELOCITY_RANGE: [number, number] = [10, 160];

/** Varre ângulos e velocidades inteiros e registra os tiros que acertam o alvo. */
function survey(w: World, me: PlayerIndex, from: Point, target: PlayerIndex): Survey {
  const rect = riderBounds(w.riders[target]);
  const hits: Shot[] = [];
  const pilotHits: Shot[] = [];
  let closest: Candidate = { shot: { angle: 45, velocity: 60 }, minDist: Infinity };
  for (let angle = ANGLE_RANGE[0]; angle <= ANGLE_RANGE[1]; angle++) {
    for (let velocity = VELOCITY_RANGE[0]; velocity <= VELOCITY_RANGE[1]; velocity++) {
      const shot = { angle, velocity };
      const r = simulate(me, from, shot, w, rect);
      const ev = r.event;
      if (ev.kind === 'pilot' || ev.kind === 'moto') {
        if (ev.index === target) {
          hits.push(shot);
          if (ev.kind === 'pilot') pilotHits.push(shot);
        }
        continue;
      }
      if (r.minDist < closest.minDist) closest = { shot, minDist: r.minDist };
    }
  }
  return { hits, pilotHits, closest };
}

/** Prefere tiros com ângulo "natural" (25°–70°). */
function pickHit(rng: Rng, hits: Shot[]): Shot {
  const natural = hits.filter((s) => s.angle >= 25 && s.angle <= 70);
  const pool = natural.length ? natural : hits;
  return pool[Math.floor(rng() * pool.length)];
}

function hitsAnyRider(w: World, me: PlayerIndex, from: Point, shot: Shot): boolean {
  const k = simulate(me, from, shot, w, riderBounds(w.riders[me])).event.kind;
  return k === 'pilot' || k === 'moto';
}

/** Um tiro por pouco: ajusta a velocidade até não acertar ninguém. */
function nearMiss(rng: Rng, w: World, me: PlayerIndex, from: Point, base: Shot, minDelta = 2): Shot {
  const deltas = [2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25].filter((d) => d >= minDelta);
  const firstSign = rng() < 0.5 ? -1 : 1;
  for (const d of deltas) {
    for (const s of [firstSign, -firstSign]) {
      const shot = { angle: base.angle, velocity: Math.max(1, base.velocity + s * d) };
      if (!hitsAnyRider(w, me, from, shot)) return shot;
    }
  }
  return safeShot(w, me, from);
}

/** Último recurso: um tiro que com certeza não acerta ninguém. */
function safeShot(w: World, me: PlayerIndex, from: Point): Shot {
  for (let v = 5; v <= 200; v += 3) {
    for (const angle of [45, 30, 60, 20, 75]) {
      const shot = { angle, velocity: v };
      if (!hitsAnyRider(w, me, from, shot)) return shot;
    }
  }
  return { angle: 45, velocity: 1 };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Decide o tiro do computador.
 * - fácil: nunca acerta (todo tiro é verificado na simulação antes de ser feito);
 * - médio: erra cada vez menos e garante acerto a partir do 5º tiro da rodada;
 * - difícil: 35% no 1º tiro, 60% no 2º e acerto garantido do 3º em diante;
 *   quando acerta, mira no piloto 30% das vezes (se houver tiro que pegue nele).
 * @param shotIndex quantos tiros o computador já deu nesta rodada (0 = primeiro)
 */
export function planComputerShot(
  difficulty: Difficulty,
  w: World,
  me: PlayerIndex,
  from: Point,
  target: PlayerIndex,
  shotIndex: number,
  rng: Rng = Math.random,
): Shot {
  const { hits, pilotHits, closest } = survey(w, me, from, target);
  const motoHits = hits.filter((h) => !pilotHits.includes(h));
  const base = hits.length ? pickHit(rng, motoHits.length ? motoHits : hits) : closest.shot;

  if (difficulty === 'dificil') {
    const chance = shotIndex === 0 ? 0.35 : shotIndex === 1 ? 0.6 : 1;
    if (hits.length && rng() < chance) {
      return pilotHits.length && rng() < 0.3 ? pickHit(rng, pilotHits) : base;
    }
    if (!hits.length) return closest.shot; // caminho bloqueado: abre caminho no prédio
    return nearMiss(rng, w, me, from, base);
  }

  if (difficulty === 'medio') {
    if (hits.length && shotIndex >= 4) return base;
    const decay = Math.pow(0.6, shotIndex);
    const err = Math.max(2, 14 * decay) * (0.7 + 0.6 * rng());
    const shot = {
      angle: clamp(Math.round(base.angle + (rng() - 0.5) * 6 * decay), 5, 89),
      velocity: clamp(Math.round(base.velocity + (rng() < 0.5 ? -1 : 1) * err), 5, 200),
    };
    const ev = simulate(me, from, shot, w, riderBounds(w.riders[target])).event;
    if ((ev.kind === 'pilot' || ev.kind === 'moto') && ev.index === me) return nearMiss(rng, w, me, from, base);
    return shot;
  }

  // fácil: tenta parecer que mira, mas erra sempre
  for (let i = 0; i < 300; i++) {
    const angle = clamp(Math.round(base.angle + (rng() - 0.5) * 30), 15, 85);
    const factor = rng() < 0.5 ? 0.6 + rng() * 0.2 : 1.2 + rng() * 0.25;
    const shot = { angle, velocity: clamp(Math.round(base.velocity * factor), 5, 200) };
    if (!hitsAnyRider(w, me, from, shot)) return shot;
  }
  return nearMiss(rng, w, me, from, base, 6);
}
