import { CRATER_RADIUS, DESTROY_CRATER_RADIUS, MOTO_HP, RIDER_SIZE } from '../../src/games/capacete-voador/game/constants';
import type { PlayerIndex } from '../../src/games/capacete-voador/game/types';
import { expect, test } from './support/test';

test.describe('Capacete Voador — acertos', () => {
  test('CV-RN-17 prédio: cratera de raio 6 no ponto do impacto e passa a vez', async ({ game }) => {
    await game.play({ mode: 'pvp' });
    const shot = await game.findShotOrRestart({ kind: 'building', player: 0, angles: [30, 80] });
    const { x, y } = shot.sim;
    const ring = (r: number) => [[x + r, y], [x - r, y], [x, y + r], [x, y - r]].map(([a, b]) => ({ x: Math.round(a), y: Math.round(b) }));
    expect(await game.hook((h, p) => h.solid(p.x, p.y), { x: Math.floor(x), y: Math.floor(y) }), 'pixel do impacto é prédio').toBe(true);
    const s = await game.shoot(shot.angle, shot.velocity, 0);
    const o = s.outcomes.at(-1)!;
    expect(o.kind).toBe('building');
    for (const p of ring(CRATER_RADIUS - 1)) expect(await game.hook((h, q) => h.solid(q.x, q.y), p), `cratera em (${p.x}, ${p.y})`).toBe(false);
    expect(s.turn).toBe(1);
    expect(s.damage).toEqual([0, 0]);
  });

  test('CV-RN-18 CV-RN-19 três acertos na moto: baú, farol e roda, destruição e ponto do outro', async ({ game, page }) => {
    await game.play({ mode: 'pvp', names: ['Ana', 'Bia'] });
    await game.findShotOrRestart({ kind: 'moto', index: 1, player: 0 });
    const msgs = ['Ana quebrou o baú de Bia!', 'Ana quebrou o farol e a roda de Bia!', 'A moto de Bia foi destruída!'];
    for (let hit = 1; hit <= MOTO_HP; hit++) {
      await game.waitAim(0);
      const shot = await game.findShot({ kind: 'moto', index: 1, player: 0 });
      expect(shot, `tiro na moto (acerto ${hit})`).not.toBeNull();
      await game.aim(shot!.angle, shot!.velocity, 0);
      await game.fire('enter', 0);
      await game.advanceUntil((h) => h.state().phase === 'exploding', 30, undefined, 1);
      const ex = await game.state();
      expect(ex.damage[1]).toBe(hit);
      expect(ex.explosion!.big, 'explosão grande só na destruição').toBe(hit === MOTO_HP);
      await expect(game.banner()).toHaveText(msgs[hit - 1]);
      await expect(game.panel(1).locator('.moto-hp')).toHaveAttribute('aria-label', `Moto: ${MOTO_HP - hit} de 3`);
      const s = await game.waitShot();
      if (hit < MOTO_HP) {
        expect(s.turn, 'passa a vez').toBe(1);
        await game.passTurn(1);
      } else {
        expect(s.phase).toBe('roundOver');
        expect(s.roundWinner).toBe(0);
        expect(s.scores).toEqual([1, 0]);
        const r = s.riders[1];
        const cx = Math.round(r.x + RIDER_SIZE / 2);
        const cy = Math.round(r.y + RIDER_SIZE - 4);
        for (const [dx, dy] of [[0, 0], [DESTROY_CRATER_RADIUS - 2, 0], [-(DESTROY_CRATER_RADIUS - 2), 0], [0, DESTROY_CRATER_RADIUS - 2]]) {
          expect(await game.hook((h, p) => h.solid(p.x, p.y), { x: cx + dx, y: cy + dy }), 'cratera sob a moto destruída').toBe(false);
        }
        await expect(page.locator('.capacete-voador .scoreboard span').first()).toHaveText('1 >Placar< 0');
      }
    }
  });

  test('CV-RN-20 cabeça: nocaute e fim da rodada na hora, com a moto inteira', async ({ game }) => {
    await game.play({ mode: 'pvp', names: ['Ana', 'Bia'] });
    const shot = await game.findShotOrRestart({ kind: 'pilot', index: 1, player: 0 }, 15);
    await game.aim(shot.angle, shot.velocity, 0);
    await game.fire('enter', 0);
    await game.advanceUntil((h) => h.state().phase === 'exploding', 30, undefined, 1);
    let s = await game.state();
    expect(s.knockedOut).toEqual([false, true]);
    expect(s.damage).toEqual([0, 0]);
    await expect(game.banner()).toHaveText('Capacetada na cabeça de Bia!');
    s = await game.waitShot();
    expect(s.phase).toBe('roundOver');
    expect(s.scores).toEqual([1, 0]);
    expect(s.roundWinner).toBe(0);
  });

  test('CV-RN-21 acertar a própria moto e a própria cabeça conta contra quem atirou', async ({ game }) => {
    await game.play({ mode: 'pvp', names: ['Ana', 'Bia'] });
    // cidade em que o jogador 1 tem tiro na própria moto e na própria cabeça (Reiniciar sorteia outra)
    for (let i = 0; i < 10; i++) {
      const moto = await game.findShot({ kind: 'moto', index: 0, player: 0 });
      const head = await game.findShot({ kind: 'pilot', index: 0, player: 0 });
      if (moto && head) break;
      await game.restart();
    }
    const moto = (await game.findShot({ kind: 'moto', index: 0, player: 0 }))!;
    let s = await game.shoot(moto.angle, moto.velocity, 0);
    expect(s.damage).toEqual([1, 0]);
    await expect(game.banner()).toHaveText('Ana quebrou o baú da própria moto!');
    expect(s.turn).toBe(1);
    await game.passTurn(1);
    await game.waitAim(0);
    const head = (await game.findShot({ kind: 'pilot', index: 0, player: 0 }))!;
    expect(head).not.toBeNull();
    s = await game.shoot(head.angle, head.velocity, 0);
    await expect(game.banner()).toHaveText('Ana acertou a própria cabeça!');
    expect(s.knockedOut).toEqual([true, false]);
    expect(s.phase).toBe('roundOver');
    expect(s.roundWinner).toBe(1 as PlayerIndex);
    expect(s.scores).toEqual([0, 1]);
  });
});
