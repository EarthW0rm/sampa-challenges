/**
 * Piloto da Fuga da Rocam (plan.md 4.3): rota pela grade até o pino do pedido, desviando das viaturas;
 * garagem com 4+ estrelas; óleo quando uma viatura vem colada atrás; turbo quando ela está perto.
 * Decide do lado do Node com o estado do gancho e joga só pelo teclado (setas, Espaço, X).
 *
 * O resultado é recalculado pelos eventos: cada aumento de pontos tem que ser uma entrega (pontos-base do
 * tipo × estrelas + bônus do urgente, lidos no quadro anterior) e/ou pizzas.
 */
import { COLS, PIZZA_POINTS, POINTS, ROWS, STAR_POINTS, TILE, TIME_BONUS_PER_SEC, TURBO_MIN_RESTART } from '../../../src/games/fuga-rocam/game/constants';
import type { FugaState } from '../../../src/games/fuga-rocam/game/e2eHook';
import { mapById } from '../../../src/games/fuga-rocam/game/maps';
import { Nav } from '../../../src/games/fuga-rocam/game/nav';
import type { MapId } from '../../../src/games/fuga-rocam/game/types';
import type { Gesture, Strategy } from '../../support/pilot';
import type { FugaPage } from './page';
import { copPenalty } from './page';
import { costField, routeStep, type Tile } from './route';

export interface PilotTally {
  /** Pontos recalculados pelos eventos. */
  recalculated: number;
  deliveries: number;
  pizzas: number;
  captures: number;
  /** Vidas ganhas (item vida). */
  lifeItems: number;
  maxStars: number;
  /** Aumentos de pontos que não bateram com nenhum evento. */
  unexplained: string[];
}

const center = (t: Tile) => ({ x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE / 2 });

export function fugaStrategy(mapId: MapId): Strategy<FugaState, FugaPage> & { tally: PilotTally } {
  const map = mapById(mapId);
  const nav = new Nav(map);
  const garages: Tile[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (map.tiles[y][x] === 'g') garages.push([x, y]);
  const corners: Tile[] = [[2, 2], [COLS - 3, 2], [2, ROWS - 3], [COLS - 3, ROWS - 3]].map(([x, y]) => nav.snap('player', x, y));
  const tally: PilotTally = { recalculated: 0, deliveries: 0, pizzas: 0, captures: 0, lifeItems: 0, maxStars: 1, unexplained: [] };
  let prev: FugaState | null = null;

  const account = (a: FugaState, b: FugaState) => {
    if (b.lives < a.lives) tally.captures += a.lives - b.lives;
    if (b.lives > a.lives) tally.lifeItems += b.lives - a.lives;
    tally.maxStars = Math.max(tally.maxStars, b.stars);
    const delta = b.score - a.score;
    if (delta <= 0) return;
    let rest = delta;
    if (b.deliveries > a.deliveries && a.job) {
      // o prazo desconta o quadro da entrega antes de contar o bônus
      const bonus = a.job.timeLeft !== null ? Math.floor(a.job.timeLeft - 1 / 60) * TIME_BONUS_PER_SEC : 0;
      const pts = Math.round(POINTS[a.job.kind] * (1 + STAR_POINTS * (a.stars - 1)) + bonus);
      rest -= pts;
      tally.deliveries++;
      tally.recalculated += pts;
    }
    while (rest >= PIZZA_POINTS && rest % PIZZA_POINTS === 0) {
      rest -= PIZZA_POINTS;
      tally.pizzas++;
      tally.recalculated += PIZZA_POINTS;
    }
    if (rest !== 0) tally.unexplained.push(`t=${b.time.toFixed(2)}: +${delta} (sobra ${rest})`);
  };

  const target = (s: FugaState): Tile => {
    const p: Tile = [s.player.tx, s.player.ty];
    // 4+ estrelas e sem pedido urgente: esconde na garagem mais perto
    if (s.stars >= 4 && s.garageCd === 0 && !(s.job?.stage === 'drop' && s.job.kind === 'urgente')) {
      const best = garages.map((g) => [g, nav.dist('player', p, g)] as const).filter(([, d]) => d >= 0 && d <= 14).sort((a, b) => a[1] - b[1])[0];
      if (best) return best[0];
    }
    if (s.job) return s.job.stage === 'pickup' ? s.job.pickup : s.job.drop;
    // sem pedido: o canto mais longe das viaturas
    const far = (t: Tile) => Math.min(...s.copList.map((c) => Math.abs(c.tx - t[0]) + Math.abs(c.ty - t[1])), 99);
    return [...corners].sort((a, b) => far(b) - far(a))[0];
  };

  return {
    name: `fuga-rocam:${mapId}`,
    tally,
    async read(game) {
      const s = await game.state();
      if (prev) account(prev, s);
      prev = s;
      return s;
    },
    over: (s) => s.phase === 'over',
    decide(s): Gesture | null {
      if (s.phase === 'caught' || s.phase === 'paused') return { kind: 'wait', frames: 10, target: 'aguardar' };
      if (s.hidden) return { kind: 'wait', frames: 6, target: 'escondido' };
      const t = target(s);
      const heavy = s.job?.stage === 'drop' && s.job.kind === 'pesado';
      const fragile = s.job?.stage === 'drop' && s.job.kind === 'fragil';
      const threat = s.copList.filter((c) => !c.leaving && c.stun <= 0 && c.alpha > 0.5);
      const close = threat.filter((c) => c.d >= 0 && c.d <= 4);
      // óleo: viatura colada atrás, na mesma linha
      const behind = close.some((c) => c.dir === s.player.dir && c.d <= 3);
      if (s.phase === 'play' && behind && s.oil > 0) return { kind: 'key', key: 'KeyX', frames: 1, target: 'óleo' };
      const field = costField(s.map, t, copPenalty(s));
      const turbo = s.phase === 'play' && close.length > 0 && !fragile && !s.turboLocked && s.turbo > TURBO_MIN_RESTART;
      const step = routeStep(s.map, field, t, s.player, s.want, { turbo, heavy });
      // perto do pino de entrega: quadro a quadro (o recálculo lê o estado do quadro anterior à entrega)
      const pin = s.job ? center(s.job.stage === 'pickup' ? s.job.pickup : s.job.drop) : null;
      const nearPin = pin && Math.hypot(s.player.x - pin.x, s.player.y - pin.y) < 40;
      const frames = Math.max(1, Math.min(step.frames, nearPin ? 1 : 8));
      if (step.key) return { kind: 'key', key: step.key, frames: s.phase === 'ready' ? 1 : frames, target: `rota ${t.join(',')}` };
      if (turbo) return { kind: 'key', key: 'Space', frames, target: 'turbo' };
      return { kind: 'wait', frames, target: `rota ${t.join(',')}` };
    },
    result: (s) => ({
      mapa: s.map,
      pontos: s.score,
      recalculado: tally.recalculated,
      entregas: s.deliveries,
      entregasContadas: tally.deliveries,
      pizzas: tally.pizzas,
      capturas: tally.captures,
      vidasGanhas: tally.lifeItems,
      estrelasMax: tally.maxStars,
      vidas: s.lives,
      naoExplicados: tally.unexplained,
    }),
  };
}
