import { H, MAX_NEIGHBOR_RISE, MIN_RIDER_GAP, RIDER_SIZE, RIDER_WHEEL_ROW, ROUND_OVER_MS, W, ZONE_P1, ZONE_P2 } from '../../src/games/capacete-voador/game/constants';
import type { PlayerIndex } from '../../src/games/capacete-voador/game/types';
import { FPS } from '../support/game-page';
import type { CapacetePage } from './support/page';
import { expect, test } from './support/test';

/** Encerra a rodada com quem tem a vez acertando a própria cabeça (o ponto vai para o outro). */
async function selfKnockout(game: CapacetePage, p: PlayerIndex, precise = false): Promise<void> {
  await game.waitAim(p);
  const head = await game.findShot({ kind: 'pilot', index: p, player: p });
  expect(head, `tiro na própria cabeça do jogador ${p + 1}`).not.toBeNull();
  if (!precise) {
    await game.shoot(head!.angle, head!.velocity, p);
    return;
  }
  // quadro a quadro: para no 1º quadro da comemoração
  await game.aim(head!.angle, head!.velocity, p);
  await game.fire('enter', p);
  await game.advanceUntil((h) => h.state().phase === 'roundOver' || h.state().phase === 'gameOver', 30, undefined, 1);
}

test.describe('Capacete Voador — rodadas', () => {
  test('CV-RN-22 CV-RN-23 rodada nova com motos inteiras, cidade e vento novos; quem começa alterna', async ({ game, page }) => {
    await game.play({ mode: 'pvp', points: 10 });
    const r1 = await game.state();
    expect(r1.turn, 'rodada 1: jogador 1 começa').toBe(0);
    // dano na moto do jogador 2 antes de acabar a rodada
    const moto = await game.findShot({ kind: 'moto', index: 1, player: 0 });
    if (moto) {
      const s = await game.shoot(moto.angle, moto.velocity, 0);
      expect(s.damage[1]).toBe(1);
    } else {
      await game.passTurn(0);
    }
    await selfKnockout(game, 1, true);
    const s = await game.state();
    expect(s.phase).toBe('roundOver');
    expect(s.scores).toEqual([1, 0]);
    expect(s.roundWinner).toBe(0);
    // comemoração dura ROUND_OVER_MS
    const celebrate = Math.round((ROUND_OVER_MS / 1000) * FPS);
    await game.frames(celebrate - 5);
    expect((await game.state()).round, 'ainda comemorando').toBe(1);
    await game.frames(10);
    const r2 = await game.state();
    expect(r2.round).toBe(2);
    expect(r2.damage, 'motos inteiras').toEqual([0, 0]);
    expect(r2.knockedOut).toEqual([false, false]);
    expect(r2.buildings, 'cidade nova').not.toEqual(r1.buildings);
    expect(r2.turn, 'rodada 2: jogador 2 começa').toBe(1);
    await expect(page.locator('.capacete-voador .mode-label')).toHaveText('2 jogadores · rodada 2');

    await selfKnockout(game, 1);
    await game.waitRound(3);
    const r3 = await game.state();
    expect(r3.scores).toEqual([2, 0]);
    expect(r3.turn, 'rodada 3: jogador 1 começa').toBe(0);
    expect(new Set([r1.wind, r2.wind, r3.wind]).size, 'vento sorteado a cada rodada').toBeGreaterThan(1);

    await game.restart();
    expect((await game.state()).turn, 'Reiniciar volta ao jogador 1').toBe(0);
  });

  test('CV-RN-24 fim de partida: diálogo com vencedor e placar, Jogar de novo e Menu', async ({ game, page }) => {
    await game.play({ mode: 'pvp', names: ['Ana', 'Bia'], points: 1 });
    await selfKnockout(game, 0);
    const s = await game.state();
    expect(s.phase).toBe('gameOver');
    const dialog = page.getByRole('dialog', { name: 'Fim de jogo' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('Bia venceu!');
    await expect(dialog.locator('p')).toHaveText('0 × 1');
    await expect(game.banner()).toHaveCount(0);
    await game.frames(600);
    expect((await game.state()).phase, 'o jogo espera a escolha').toBe('gameOver');

    await dialog.getByRole('button', { name: 'Jogar de novo' }).click();
    await game.frames(1);
    expect(await game.state()).toMatchObject({ phase: 'aiming', round: 1, scores: [0, 0], turn: 0 });
    await expect(dialog).toHaveCount(0);

    await selfKnockout(game, 0);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Menu' }).click();
    await expect(game.startButton).toBeVisible();
  });

  test('CV-RN-25 cidade: prédios contíguos, alturas, MASP único e lugares dos motoboys', async ({ game }) => {
    await game.play({ mode: 'pvp' });
    for (let c = 0; c < 15; c++) {
      const s = await game.state();
      const bs = s.buildings;
      let x = 0;
      for (const b of bs) {
        expect(b.x, 'sem vão').toBe(x);
        x += b.width;
        if (b.masp) expect(b.height).toBe(30);
        else expect(b.height >= 60 && b.height <= 270, `altura ${b.height}`).toBe(true);
      }
      expect(x, 'cobre os 640 px').toBe(W);
      expect(bs.at(-1)!.width).toBeGreaterThanOrEqual(12);
      expect(bs.filter((b) => b.masp).length).toBeLessThanOrEqual(1);
      const centers: number[] = [];
      for (const p of [0, 1] as const) {
        const r = s.riders[p];
        const i = bs.findIndex((b) => b.x + Math.floor(b.width / 2) - RIDER_SIZE / 2 === r.x && H - b.height + b.roof - RIDER_WHEEL_ROW - 1 === r.y);
        expect(i, `prédio do jogador ${p + 1}`).toBeGreaterThanOrEqual(0);
        const b = bs[i];
        expect(b.flat && !b.masp, `${b.key} tem telhado reto`).toBe(true);
        expect(b.width).toBeGreaterThanOrEqual(36);
        expect(b.height).toBeGreaterThanOrEqual(60);
        for (const n of [bs[i - 1], bs[i + 1]]) if (n) expect(n.height - b.height).toBeLessThanOrEqual(MAX_NEIGHBOR_RISE);
        const center = b.x + b.width / 2;
        const zone = p === 0 ? ZONE_P1 : ZONE_P2;
        expect(center >= zone[0] && center <= zone[1], `centro ${center} na zona ${zone}`).toBe(true);
        centers.push(center);
      }
      expect(centers[1] - centers[0]).toBeGreaterThanOrEqual(MIN_RIDER_GAP);
      await game.restart();
    }
  });
});
