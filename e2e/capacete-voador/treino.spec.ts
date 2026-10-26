import { MOTO_HP, ROUND_OVER_MS } from '../../src/games/capacete-voador/game/constants';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Capacete Voador — treino', () => {
  test('CV-RN-31 treino: só o J1 atira, Tiros/Acertos, rodada acaba na destruição com (n tiros) e não há fim de partida', async ({ game, page }) => {
    await game.play({ mode: 'practice', names: ['Ana'] });
    const board = page.locator('.capacete-voador .scoreboard span').first();
    await expect(board).toHaveText('Tiros 0 · Acertos 0');
    let s = await game.passTurn(0);
    expect(s.turn, 'o alvo nunca ataca').toBe(0);
    await expect(board).toHaveText('Tiros 1 · Acertos 0');

    for (let hit = 1; hit <= MOTO_HP; hit++) {
      await game.waitAim(0);
      const shot = await game.findShot({ kind: 'moto', index: 1, player: 0 });
      expect(shot, `tiro na moto do alvo (${hit})`).not.toBeNull();
      s = await game.shoot(shot!.angle, shot!.velocity, 0);
      expect(s.turn).toBe(0);
      expect(s.practiceHits).toBe(hit);
    }
    await expect(game.banner()).toHaveText(`A moto de Motoboy-alvo foi destruída! (${MOTO_HP + 1} tiros)`);
    await expect(board).toHaveText(`Tiros ${MOTO_HP + 1} · Acertos ${MOTO_HP}`);
    expect(s.phase).toBe('roundOver');
    expect(s.roundWinner).toBe(0);
    expect(s.scores, 'treino não soma placar').toEqual([0, 0]);

    await game.frames(Math.round((ROUND_OVER_MS / 1000) * FPS) + 30);
    s = await game.state();
    expect(s).toMatchObject({ round: 2, phase: 'aiming', turn: 0, damage: [0, 0] });

    // acertar a si mesmo também encerra a rodada, sem vencedor, e nunca há fim de partida
    await game.waitAim(0);
    const self = await game.findShot({ kind: 'pilot', index: 0, player: 0 });
    expect(self, 'tiro na própria cabeça').not.toBeNull();
    s = await game.shoot(self!.angle, self!.velocity, 0);
    expect(s.phase).toBe('roundOver');
    expect(s.roundWinner).toBeNull();
    await game.waitRound(3);
    expect((await game.state()).phase).toBe('aiming');
    expect(s.outcomes.every((o) => o.by === 0), 'só o jogador 1 atirou').toBe(true);
  });
});
