import { BONUS_PTS, PTS } from '../../src/games/pinball-paulista/game/constants';
import { delta } from './support/rules';
import { expect, test } from './support/test';

test.describe('Pinball Paulista — MOTOBOY e Multiball', () => {
  test('PP-RN-12 letra nova vale PTS.letraNova, acesa PTS.letraAcesa, e só conta do lado do campo', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida no teste
    const t = await game.targets();
    const shoot = async (i: number, from: 'campo' | 'corredor') => {
      const g = t.targets[i];
      const y = (g.y1 + g.y2) / 2;
      // pré-condição: bola indo de lado contra a placa i (pelo campo ou por dentro do corredor)
      const side = from === 'campo' ? g.nx : -g.nx;
      await game.placeBall(g.x + side * 15, y, -side * 250, 0);
      await game.ev.quiet(() => game.frames(4));
    };
    let s0 = await game.state();
    await shoot(0, 'campo');
    let s1 = await game.state();
    expect(s1.letters[0]).toBe(true);
    expect(delta(s0, s1, 'letraNova')).toEqual({ n: 1, pts: PTS.letraNova });
    expect(s1.bonusBase - s0.bonusBase).toBe(BONUS_PTS.alvo);
    await expect(page.locator('.pinball-paulista .letters b.on')).toHaveText(['M']);
    await shoot(0, 'campo');
    const s2 = await game.state();
    expect(delta(s1, s2, 'letraAcesa')).toEqual({ n: 1, pts: PTS.letraAcesa });
    expect(s2.bonusBase - s1.bonusBase).toBe(BONUS_PTS.alvo);
    s0 = await game.state();
    await shoot(1, 'corredor');
    s1 = await game.state();
    expect(s1.letters[1], 'por dentro do corredor não conta').toBe(false);
    expect(delta(s0, s1, 'letraNova').n).toBe(0);
    await shoot(6, 'campo');
    expect((await game.state()).letters[6], 'Y, do lado direito').toBe(true);
  });

  test('PP-RN-13 7 letras: Multiball com 2 bolas, bumper em dobro e bola perdida só quando cai a última', async ({ game, page }) => {
    await game.open();
    await game.launchIntoPlay();
    // pré-condição: 6 letras acesas (falta o Y) e segura-bola desligado
    await game.lights({ letters: [true, true, true, true, true, true, false], saver: 0 });
    const t = await game.targets();
    const y = t.targets[6];
    const s0 = await game.state();
    // pré-condição: bola indo para a placa Y pelo campo
    await game.placeBall(y.x - 15, (y.y1 + y.y2) / 2, 250, 0);
    await game.advanceUntil((h) => h.state().balls.length === 3, 1, undefined, 1);
    let s = await game.state();
    expect(delta(s0, s, 'multiball')).toEqual({ n: 1, pts: PTS.multiball });
    expect(s.letters).toEqual([false, false, false, false, false, false, false]);
    expect(s.message).toBe('MULTIBALL!');
    await expect(page.locator('.pinball-paulista .chip', { hasText: 'Multiball' })).toBeVisible();
    // bumper com mais de uma bola: em dobro
    const b = t.bumpers[0];
    const before = await game.state();
    await game.placeBall(b.x, b.y - 31, 0, 150); // pré-condição: bola caindo no bumper
    await game.advanceUntil((h) => h.state().bumperHits[0] > 0, 1, undefined, 1);
    expect(delta(before, await game.state(), 'bumper')).toEqual({ n: 1, pts: 2 * PTS.bumper });
    // espera a mensagem do Multiball sumir e leva as bolas ao ralo, uma por vez
    await game.advanceUntil((h) => h.state().message === '' || h.state().balls.length < 3, 4);
    s = await game.state();
    while (s.balls.length > 1) {
      await game.drainBall(s.balls.length - 1); // pré-condição: bola no ralo
      await game.ev.quiet(() => game.frames(20));
      s = await game.state();
      expect(s.phase, 'ainda há bola na mesa').toBe('play');
    }
    expect(s.ball).toBe(1);
    expect(s.message).toBe('FIM DO MULTIBALL');
    await game.drainBall(0); // pré-condição: a última bola no ralo
    await game.waitPhase('bonus', 2);
  });
});
