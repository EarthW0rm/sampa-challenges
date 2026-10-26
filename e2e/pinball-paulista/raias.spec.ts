import { BONUS_PTS, MAX_MULT, PTS } from '../../src/games/pinball-paulista/game/constants';
import { delta } from './support/rules';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — raias do topo', () => {
  test('PP-RN-11 raia apagada acende, acesa não pontua, flipper gira as luzes e as 3 sobem o multiplicador até MAX_MULT', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida no teste
    const t = await game.targets();
    const through = async (i: number) => {
      // pré-condição: bola subindo pela raia i
      await game.placeBall(t.rollovers[i].x, t.rollovers[i].y + 22, 0, -250);
      await game.ev.quiet(() => game.frames(8));
      // pré-condição: tira a bola do topo (senão ela cruza as raias de novo ao cair)
      await game.placeBall(111, 300, 0, 0);
    };
    let s0 = await game.state();
    await through(0);
    let s1 = await game.state();
    expect(s1.rolls).toEqual([true, false, false]);
    expect(delta(s0, s1, 'raia')).toEqual({ n: 1, pts: PTS.raia });
    expect(s1.bonusBase - s0.bonusBase).toBe(BONUS_PTS.raia);
    await through(0);
    expect(delta(s1, await game.state(), 'raia').n, 'raia acesa não pontua').toBe(0);

    await game.keyDown('z');
    await game.keyUp('z');
    expect((await game.state()).rolls, 'esquerdo gira para a esquerda').toEqual([false, false, true]);
    await game.keyDown('/');
    await game.keyUp('/');
    expect((await game.state()).rolls, 'direito gira para a direita').toEqual([true, false, false]);
    await game.ev.quiet(async () => {
      await page.keyboard.down('z');
      await page.keyboard.down('/');
      await game.frames(1);
      await page.keyboard.up('z');
      await page.keyboard.up('/');
      await game.frames(1);
    });
    await game.evidence('Z e / no mesmo quadro');
    expect((await game.state()).rolls, 'os dois juntos: conta o esquerdo').toEqual([false, false, true]);

    s0 = await game.state();
    await through(0);
    await through(1);
    s1 = await game.state();
    // as 3 acesas apagam e a mesma passagem reacende a raia que completou (a bola ainda está no sensor)
    expect(s1.rolls).toEqual([false, true, false]);
    expect(s1.mult).toBe(2);
    expect(delta(s0, s1, 'raias')).toEqual({ n: 1, pts: PTS.raias });
    expect(delta(s0, s1, 'raia')).toEqual({ n: 3, pts: 3 * PTS.raia });
    await expect(page.locator('.pinball-paulista .mult')).toHaveText('×2');

    // pré-condição: multiplicador já no máximo e duas raias acesas
    await game.lights({ mult: MAX_MULT, rolls: [true, true, false] });
    s0 = await game.state();
    await through(2);
    s1 = await game.state();
    expect(s1.mult).toBe(MAX_MULT);
    expect(delta(s0, s1, 'raias')).toEqual({ n: 1, pts: PTS.raias });
    expect(s1.rolls).toEqual([false, false, true]);
  });
});
