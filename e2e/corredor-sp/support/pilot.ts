/**
 * Piloto do Corredor SP (plan.md 4.3): ↑ segurado o turno inteiro; a cada decisão escolhe a faixa ou o
 * corredor com mais pista livre à frente (penalizando atravessar veículos ao lado), freia quando tudo está
 * fechado perto, arremessa capacete quando o bloqueio é removível e dá grau na faixa azul livre.
 * Só lê o estado pelo gancho; age por teclas.
 */
import { CORRIDORS, LANES, METERS_PER_POINT } from '../../../src/games/corredor-sp/game/constants';
import type { CorredorSnapshot } from '../../../src/games/corredor-sp/game/engine';
import type { Gesture, Strategy } from '../../support/pilot';
import type { CorredorPage } from './page';

/** 15 min de jogo (tasks.md TF-130-06). */
export const MAX_FRAMES = 15 * 60 * 60;

const SPOTS = [...LANES, ...CORRIDORS].sort((a, b) => a - b);
const LOOK = 9000;

type Obstacle = { x: number; dz: number; half: number; removable: boolean; kind: string };

function obstacles(s: CorredorSnapshot): Obstacle[] {
  const out: Obstacle[] = [];
  for (const v of s.vehicles) {
    if (v.state === 'spinout') continue;
    if (v.kind === 'moto' && v.dz < 0) continue; // moto atrás desvia
    if (v.dz < -(v.len / 2 + 200) || v.dz > LOOK) continue;
    out.push({ x: v.x, dz: v.dz - v.len / 2, half: v.halfW, removable: v.removable, kind: v.kind });
  }
  for (const h of s.hazards) {
    if (h.hit || h.dz < -250 || h.dz > LOOK) continue;
    out.push({ x: h.x, dz: h.dz, half: 0.06, removable: h.kind === 'cone', kind: h.kind });
  }
  return out;
}

/** Distância livre à frente na posição lateral `x` (com folga), e quem bloqueia. */
function freeAt(obs: Obstacle[], x: number): { free: number; by: Obstacle | null } {
  let free = LOOK;
  let by: Obstacle | null = null;
  for (const o of obs) {
    if (Math.abs(o.x - x) >= o.half + 0.05 + 0.04) continue;
    const d = Math.max(0, o.dz);
    if (d < free) {
      free = d;
      by = o;
    }
  }
  return { free, by };
}

/** Atravessar de `from` a `to` bate em quem está ao lado agora? */
function pathBlocked(obs: Obstacle[], from: number, to: number): boolean {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return obs.some((o) => o.dz < 900 && o.dz > -700 && o.x + o.half + 0.06 > lo && o.x - o.half - 0.06 < hi);
}

export function corredorStrategy(): Strategy<CorredorSnapshot, CorredorPage> {
  return {
    name: 'corredor-sp',
    read: (g) => g.state(),
    over: (s) => s.phase === 'over',
    result: (s) => ({
      pista: s.track,
      pontos: s.points,
      recalculado: (Math.floor(s.time) + Math.floor(s.meters / METERS_PER_POINT)) * (1 + s.packages),
      segundos: Math.floor(s.time),
      metros: Math.floor(s.meters),
      pacotes: s.packages,
      nivel: s.level,
      ultrapassagens: s.overtakes,
      recordeAntes: s.record,
    }),
    decide: (s): Gesture | null => {
      if (s.phase !== 'racing' || s.player.crashT > 0) return null;
      const p = s.player;
      const obs = obstacles(s);
      const here = freeAt(obs, p.x);
      // capacete: bloqueio removível perto na linha
      if (p.helmets > 0 && here.by?.removable && here.free < 5000) return { kind: 'key', key: 'x', frames: 1, target: `capacete em ${here.by.kind}` };
      let best = p.x;
      let bestScore = -Infinity;
      for (const c of SPOTS) {
        const f = freeAt(obs, c).free;
        const blocked = Math.abs(c - p.x) > 0.05 && pathBlocked(obs, p.x, c);
        const item = s.items.some((it) => Math.abs(it.x - c) < 0.1 && it.dz > 0 && it.dz < f) ? 800 : 0;
        const score = f + item - Math.abs(c - p.x) * 1500 - (blocked ? 20000 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      const bestFree = freeAt(obs, best).free;
      // tudo fechado perto: freia
      if (bestFree < 1800 && here.free < 2500 && p.kmh > 30) return { kind: 'key', key: 'ArrowDown', frames: 6, target: 'freio' };
      const dx = best - p.x;
      if (Math.abs(dx) > 0.04) return { kind: 'key', key: dx > 0 ? 'ArrowRight' : 'ArrowLeft', frames: Math.abs(dx) > 0.2 ? 6 : 2, target: `posição ${best.toFixed(2)}` };
      // grau na faixa azul livre
      if (Math.abs(p.x - CORRIDORS[0]) < 0.08 && here.free >= LOOK && p.grau > 0.4) return { kind: 'key', key: 'Space', frames: 20, target: 'grau na faixa azul' };
      return null;
    },
  };
}
