import {
  HEAT_DELIVERY, HEAVY_HEAT, HEAVY_MULT, JOB_DROP_DIST, JOB_PICKUP_DIST, JOB_UNLOCK, LATE_HEAT, LATE_JOB_DELAY, NEXT_JOB_DELAY, PLAYER_SPEED,
  POINTS, STAR_POINTS, TILE, TIME_BONUS_PER_SEC, URGENT_EXTRA, URGENT_FACTOR, URGENT_MIN,
} from '../../src/games/fuga-rocam/game/constants';
import { mapById } from '../../src/games/fuga-rocam/game/maps';
import { Nav } from '../../src/games/fuga-rocam/game/nav';
import type { JobKind } from '../../src/games/fuga-rocam/game/types';
import type { FugaState } from '../../src/games/fuga-rocam/game/e2eHook';
import type { FugaPage } from './support/page';
import { expect, test } from './support/test';

const nav = new Nav(mapById('centro'));
const base = (kind: JobKind, stars: number) => Math.round(POINTS[kind] * (1 + STAR_POINTS * (stars - 1)));
const near = (s: FugaState, px = 24) => !!s.job && s.job.stage === 'drop' && Math.hypot(s.player.x - (s.job.drop[0] * TILE + TILE / 2), s.player.y - (s.job.drop[1] * TILE + TILE / 2)) <= px;

/** Leva o pedido até o pino verde (o fim quadro a quadro); devolve [antes, depois, pontos da mensagem]. */
async function dropAndScore(game: FugaPage): Promise<[FugaState, FugaState, number]> {
  const s0 = await game.drop({ until: (x) => near(x, 40), step: 3 });
  const d0 = s0.deliveries;
  let prev = s0;
  let last = s0;
  const s = await game.drop({
    step: 1,
    trace: (x) => {
      prev = last;
      last = x;
    },
  });
  expect(s.deliveries, 'entregou').toBe(d0 + 1);
  const m = /Entrega feita! \+(\d+)/.exec(s.message);
  expect(m, `mensagem da entrega: "${s.message}"`).not.toBeNull();
  expect(prev.deliveries).toBe(d0);
  return [prev, s, Number(m![1])];
}

test.describe('Fuga da Rocam — pedidos', () => {
  test('FR-RN-11 FR-RN-12 FR-RN-16 coleta, entrega, pontos por estrela e tipos liberados pelas entregas', async ({ game }) => {
    test.setTimeout(180_000);
    await game.start('centro', { seed: 3 });
    for (let n = 0; n < JOB_UNLOCK.urgente; n++) {
      let s = await game.state();
      const job = s.job!;
      expect(job.stage).toBe('pickup');
      // tipo sorteado só entre os liberados pelas entregas já feitas
      if (s.deliveries < JOB_UNLOCK.fragil) expect(job.kind, `pedido ${n + 1}`).toBe('normal');
      if (s.deliveries < JOB_UNLOCK.urgente) expect(job.kind).not.toBe('urgente');
      const from = n === 0 ? ([s.player.tx, s.player.ty] as [number, number]) : null;
      if (from) {
        const dp = nav.dist('player', from, job.pickup);
        expect(dp).toBeGreaterThanOrEqual(JOB_PICKUP_DIST[0]);
        expect(dp).toBeLessThanOrEqual(JOB_PICKUP_DIST[1]);
      }
      const dd = nav.dist('player', job.pickup, job.drop);
      expect(dd).toBeGreaterThanOrEqual(JOB_DROP_DIST[0]);
      expect(dd).toBeLessThanOrEqual(JOB_DROP_DIST[1]);

      s = await game.pickup();
      expect(s.job?.stage, 'coletado no pino amarelo').toBe('drop');
      const [before, after, pts] = await dropAndScore(game);
      const bonus = job.kind === 'urgente' ? Math.floor(before.job!.timeLeft!) * TIME_BONUS_PER_SEC : 0;
      expect(pts, `pontos do pedido ${job.kind} com ${before.stars} estrela(s)`).toBe(base(job.kind, before.stars) + bonus);
      expect(after.score - before.score).toBe(pts);
      expect(after.deliveries).toBe(before.deliveries + 1);
      expect(after.heat - before.heat).toBeCloseTo(HEAT_DELIVERY + (job.kind === 'pesado' ? HEAVY_HEAT : 0), 0);
      expect(after.job).toBeNull();
      // o próximo pedido chega em NEXT_JOB_DELAY
      await game.frames(Math.round(NEXT_JOB_DELAY * 60) - 3);
      expect((await game.state()).job, 'ainda sem pedido').toBeNull();
      await game.frames(4);
      expect((await game.state()).job?.stage).toBe('pickup');
    }
  });

  test('FR-RN-13 frágil: turbo não liga levando o pedido; vale POINTS.fragil', async ({ game }) => {
    await game.start('centro', { seed: 5 });
    // pré-condição rara: o 1º pedido vira frágil (só sai sozinho depois de JOB_UNLOCK.fragil entregas)
    await game.hook((h) => h.prepare.jobKind('fragil'));
    const p = await game.pickup();
    // turbo segurado a caminho do pino verde, depois que a mensagem da coleta ("Frágil! Sem turbo", 2 s) some
    const s = await game.drop({ turbo: true, until: (x) => x.time > p.time + 2.3 || near(x, 60) });
    expect(s.turboOn).toBe(false);
    expect(s.turbo).toBe(1);
    expect(s.message).toBe('Frágil: sem turbo!');
    const [before, , pts] = await dropAndScore(game);
    expect(pts).toBe(base('fragil', before.stars));
  });

  test('FR-RN-14 urgente: prazo pela distância, bônus por segundo; atrasou perde o pedido e esquenta', async ({ game }) => {
    test.setTimeout(180_000);
    await game.start('centro', { seed: 7 });
    // pré-condição rara: o pedido vira urgente (sairia sozinho só depois de JOB_UNLOCK.urgente entregas)
    await game.hook((h) => h.prepare.jobKind('urgente'));
    let s = await game.pickup();
    const tiles = nav.dist('player', s.job!.pickup, s.job!.drop);
    const limit = Math.max(URGENT_MIN, ((tiles * TILE) / PLAYER_SPEED) * URGENT_FACTOR + URGENT_EXTRA);
    expect(s.job!.timeLeft!).toBeLessThanOrEqual(limit);
    expect(s.job!.timeLeft!).toBeGreaterThan(limit - 0.15);
    const [before, , pts] = await dropAndScore(game);
    expect(pts).toBe(base('urgente', before.stars) + Math.floor(before.job!.timeLeft!) * TIME_BONUS_PER_SEC);

    // segundo urgente: foge do pino verde até o prazo acabar
    s = await game.waitJob();
    await game.hook((h) => h.prepare.jobKind('urgente'));
    s = await game.pickup();
    const far: [number, number][] = [[2, 2], [37, 22], [37, 2], [2, 22]];
    let k = 0;
    while (s.job?.stage === 'drop' && (s.job.timeLeft ?? 0) > 0.2) {
      if (s.phase === 'caught') s = await game.waitCaught();
      const t = far[k++ % far.length];
      s = await game.goToTile(t[0], t[1], { avoidCops: true, until: (x) => (x.job?.timeLeft ?? 0) <= 0.2 || x.phase === 'caught' });
    }
    let prev = s;
    while (s.job && s.phase === 'play') {
      prev = s;
      await game.frames(1);
      s = await game.state();
    }
    expect(s.message).toBe('Atrasou! Pedido perdido');
    expect(s.score).toBe(prev.score);
    expect(s.heat - prev.heat).toBeCloseTo(LATE_HEAT, 0);
    await game.frames(Math.round(LATE_JOB_DELAY * 60) - 3);
    expect((await game.state()).job).toBeNull();
    await game.frames(4);
    expect((await game.state()).job).not.toBeNull();
  });

  test('FR-RN-15 pesado: moto mais lenta e calor extra na entrega', async ({ game }) => {
    await game.start('centro', { seed: 9 });
    // pré-condição rara: o pedido vira pesado (sairia sozinho só depois de JOB_UNLOCK.pesado entregas)
    await game.hook((h) => h.prepare.jobKind('pesado'));
    await game.pickup();
    // um quadro em linha reta fora da faixa rápida: anda HEAVY_MULT × PLAYER_SPEED / 60
    let a = await game.state();
    for (let i = 0; i < 30; i++) {
      await game.frames(1);
      const b = await game.state();
      const straight = a.player.dir === b.player.dir && a.player.tx === b.player.tx && a.player.ty === b.player.ty && b.player.off > a.player.off;
      if (straight && b.phase === 'play') {
        expect(b.player.off - a.player.off).toBeCloseTo((PLAYER_SPEED * HEAVY_MULT) / 60, 6);
        break;
      }
      a = b;
      expect(i).toBeLessThan(29);
    }
    const [before, after, pts] = await dropAndScore(game);
    expect(pts).toBe(base('pesado', before.stars));
    expect(after.heat - before.heat).toBeCloseTo(HEAT_DELIVERY + HEAVY_HEAT, 0);
  });
});
