import {
  AWARDS,
  BONUS_PTS,
  KICKOUT,
  KICKOUT_COOLDOWN,
  KICKOUT_HOLD,
  KICK_EJECT_MIN_DEG,
  KICK_EJECT_RANGE_DEG,
  KICK_EJECT_SPEED,
  PTS,
  SAVER_AWARD_SECONDS,
  WAVE_SECONDS,
} from '../../src/games/pinball-paulista/game/constants';
import { delta } from './support/rules';
import type { PinballPage } from './support/page';
import { expect, test } from './support/test';

/** Põe a bola no buraco e espera a captura (pré-condição comentada nos testes). */
async function intoHole(game: PinballPage): Promise<void> {
  await game.placeBall(KICKOUT.x, KICKOUT.y - 17, 0, 80);
  await game.advanceUntil((h) => h.state().balls[0].held > 0, 1, undefined, 1);
}

/** Roda quadro a quadro até a bola ser solta; devolve quantos quadros ela ficou presa. */
async function untilRelease(game: PinballPage): Promise<number> {
  let n = 0;
  await game.ev.quiet(async () => {
    while ((await game.state()).balls[0].held > 0) {
      await game.frames(1);
      n++;
      if (n > 600) throw new Error('bola não saiu do Minhocão');
    }
  });
  await game.evidence(`bola solta do Minhocão depois de ${n} quadros`);
  return n;
}

test.describe('Pinball Paulista — Minhocão', () => {
  test('PP-RN-14 PP-RN-17 captura por KICKOUT_HOLD, PTS.minhocao, entupido KICKOUT_COOLDOWN e ejeção diagonal alternando o lado', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60, kickCd: 0 }); // pré-condição: a bola não pode ser perdida; buraco livre
    const s0 = await game.state();
    await intoHole(game); // pré-condição: bola no buraco
    let s = await game.state();
    expect(s.balls[0]).toMatchObject({ x: KICKOUT.x, y: KICKOUT.y, vx: 0, vy: 0 });
    expect(delta(s0, s, 'minhocao')).toEqual({ n: 1, pts: PTS.minhocao });
    expect(s.kickCd).toBeGreaterThan(KICKOUT_COOLDOWN - 0.05);
    const frames = await untilRelease(game);
    expect(Math.abs(frames - KICKOUT_HOLD * 60)).toBeLessThanOrEqual(1);
    s = await game.state();
    const first = s.balls[0];
    expect(Math.hypot(first.vx, first.vy)).toBeCloseTo(KICK_EJECT_SPEED, 6);
    const deg = (Math.atan2(Math.abs(first.vx), -first.vy) * 180) / Math.PI;
    expect(deg).toBeGreaterThanOrEqual(KICK_EJECT_MIN_DEG - 1e-9);
    expect(deg).toBeLessThanOrEqual(KICK_EJECT_MIN_DEG + KICK_EJECT_RANGE_DEG + 1e-9);
    expect(Math.sign(first.vx)).toBe(s.kickDir);

    // entupido: a bola passa pelo buraco sem cair
    const before = await game.state();
    expect(before.kickCd).toBeGreaterThan(0);
    await game.placeBall(KICKOUT.x, KICKOUT.y - 17, 0, 80); // pré-condição: bola no buraco entupido
    await game.ev.quiet(() => game.frames(20));
    expect(delta(before, await game.state(), 'minhocao').n).toBe(0);

    // rápida demais (acima de KICKOUT_MAX_SPEED): passa direto
    await game.lights({ kickCd: 0 }); // pré-condição: buraco livre de novo
    const fast = await game.state();
    await game.placeBall(KICKOUT.x, KICKOUT.y - 17, 0, 760); // pré-condição: bola muito rápida no buraco
    await game.ev.quiet(() => game.frames(4));
    expect(delta(fast, await game.state(), 'minhocao').n).toBe(0);

    // próxima captura: ejeção para o outro lado
    await game.lights({ kickCd: 0 }); // pré-condição: buraco livre
    await intoHole(game);
    await untilRelease(game);
    expect(Math.sign((await game.state()).balls[0].vx)).toBe(-Math.sign(first.vx));
  });

  test('PP-RN-15 PP-RN-16 prêmios na ordem de AWARDS e bola extra só uma vez por jogo', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    expect(AWARDS).toContain((await game.state()).nextAward);
    // pré-condição: ciclo posicionado no 1º prêmio e a bola protegida pelo segura-bola
    await game.lights({ nextAward: AWARDS[0], saver: 60 });
    for (const award of [...AWARDS, 'extra-de-novo'] as const) {
      if (award === 'extra-de-novo') await game.lights({ nextAward: 'extra' }); // pré-condição: ciclo no prêmio bola extra
      if (award === 'saver') await game.lights({ saver: 1 }); // pré-condição: segura-bola quase no fim
      await game.lights({ kickCd: 0 }); // pré-condição: buraco livre (o entupido já foi provado)
      const s0 = await game.state();
      await intoHole(game); // pré-condição: bola no buraco
      await untilRelease(game);
      const s = await game.state();
      const lit = (x: typeof s) => x.letters.filter(Boolean).length;
      switch (award) {
        case 'bonus':
        case 'extra-de-novo':
          expect(s.bonusBase - s0.bonusBase, award).toBe(BONUS_PTS.premio + BONUS_PTS.minhocao);
          expect(s.extraPending || award === 'bonus').toBe(true);
          break;
        case 'letra':
          expect(lit(s)).toBe(lit(s0) + 1);
          expect(s.letters.indexOf(false)).toBe(lit(s));
          break;
        case 'saver':
          expect(s.saver).toBeGreaterThan(SAVER_AWARD_SECONDS - 0.1);
          break;
        case 'mult':
          expect(s.mult).toBe(s0.mult + 1);
          break;
        case 'pontos':
          expect(delta(s0, s, 'premioPontos')).toEqual({ n: 1, pts: PTS.premioPontos });
          break;
        case 'onda':
          expect(delta(s0, s, 'ondaVerde')).toEqual({ n: 1, pts: PTS.ondaVerde });
          expect(s.wave).toBeGreaterThan(WAVE_SECONDS - 0.1);
          break;
        case 'extra':
          expect(s.extraPending).toBe(true);
          expect(s.extraGiven).toBe(true);
          await expect(page.locator('.pinball-paulista .chip', { hasText: 'Bola extra' })).toBeVisible();
          break;
      }
    }
  });
});
