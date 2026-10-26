import { BOX_SIZE, CATCH_RECT, DOG_SPEED, DOG_TURBO_SPEED, DOG_Y, GRAU_LIFT, IMA_RANGE, MAX_LIVES, POWER_DURATION, START_LIVES } from '../../src/games/cachorro-loko/game/constants';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — poderes', () => {
  test.beforeEach(async ({ game }) => {
    await game.play();
    // pré-condição: chapeiro parado; os pacotes especiais são postos na rua pelo prepare
    await game.chef(false);
  });

  test('CL-RN-16 CL-RN-21 CL-RN-30 turbo: DOG_TURBO_SPEED por 8 s, repegar reinicia o tempo, HUD com segundos', async ({ game, page }) => {
    await game.settle(await game.dropOnDog('turbo'));
    let s = await game.state();
    expect(s.powers.turbo).toBeGreaterThan(POWER_DURATION.turbo - 0.2);
    await expect(page.locator('.cachorro-loko .power')).toHaveText(`Turbo ${POWER_DURATION.turbo}s`);
    let x = s.dog.x;
    await game.walk('left', FPS / 2);
    expect(x - (await game.state()).dog.x).toBeCloseTo(DOG_TURBO_SPEED / 2, 6);

    await game.frames(4 * FPS);
    s = await game.state();
    expect(s.powers.turbo).toBeLessThan(POWER_DURATION.turbo - 4);
    await expect(page.locator('.cachorro-loko .power')).toHaveText(`Turbo ${Math.ceil(s.powers.turbo)}s`);
    // repegar: volta para a duração cheia, não soma
    await game.settle(await game.dropOnDog('turbo'));
    s = await game.state();
    expect(s.powers.turbo).toBeGreaterThan(POWER_DURATION.turbo - 0.2);
    expect(s.powers.turbo).toBeLessThanOrEqual(POWER_DURATION.turbo);

    await game.frames(POWER_DURATION.turbo * FPS + 1);
    s = await game.state();
    expect(s.powers.turbo).toBe(0);
    await expect(page.locator('.cachorro-loko .power')).toHaveCount(0);
    x = s.dog.x;
    await game.walk('right', FPS / 2);
    expect((await game.state()).dog.x - x).toBeCloseTo(DOG_SPEED / 2, 6);
  });

  test('CL-RN-17 grau: a área de pega sobe GRAU_LIFT por 10 s e pega antes', async ({ game, page }) => {
    await game.settle(await game.dropOnDog('grau'));
    const s = await game.state();
    expect(s.catchRect.y).toBe(DOG_Y + CATCH_RECT.y - GRAU_LIFT);
    expect(s.catchRect.h).toBe(CATCH_RECT.h + GRAU_LIFT);
    await expect(page.locator('.cachorro-loko .power')).toHaveText(`Grau ${POWER_DURATION.grau}s`);
    const ev = await game.settle(await game.dropOnDog('normal'));
    expect(ev.ev).toBe('catch');
    // sem o grau o pacote só encostaria com o fundo abaixo de DOG_Y + CATCH_RECT.y
    expect(ev.y + BOX_SIZE).toBeLessThanOrEqual(DOG_Y + CATCH_RECT.y);
    await game.frames(POWER_DURATION.grau * FPS + 1);
    expect((await game.state()).catchRect.y).toBe(DOG_Y + CATCH_RECT.y);
  });

  test('CL-RN-18 ímã: puxa pacotes e bombas a menos de IMA_RANGE do baú; mais longe, caem', async ({ game, page }) => {
    await game.settle(await game.dropOnDog('ima'));
    await expect(page.locator('.cachorro-loko .power')).toHaveText(`Ímã ${POWER_DURATION.ima}s`);
    const r = (await game.state()).catchRect;
    const cx = r.x + r.w / 2;
    // centro do pacote a IMA_RANGE − 4 px do centro da área: puxado e pego
    let ev = await game.settle(await game.dropAt('normal', cx - (IMA_RANGE - 4) - BOX_SIZE / 2));
    expect(ev).toMatchObject({ ev: 'catch', score: 2 });
    // bomba também é puxada (de propósito)
    ev = await game.settle(await game.dropAt('bomba', cx + (IMA_RANGE - 4) - BOX_SIZE / 2));
    expect(ev).toMatchObject({ ev: 'catch', kind: 'bomba', lives: START_LIVES - 1 });
    // fora do alcance: cai no asfalto
    ev = await game.settle(await game.dropAt('normal', cx - (IMA_RANGE + 20) - BOX_SIZE / 2));
    expect(ev).toMatchObject({ ev: 'land', lives: START_LIVES - 2 });
  });

  test('CL-RN-19 CL-RN-20 CL-RN-30 vida soma até MAX_LIVES; dobro vale 2 por pacote por 10 s, a própria caixa vale 1', async ({ game, page }) => {
    let ev = await game.settle(await game.dropOnDog('vida'));
    expect(ev).toMatchObject({ ev: 'catch', points: 1, lives: START_LIVES + 1 });
    ev = await game.settle(await game.dropOnDog('vida'));
    expect(ev.lives).toBe(MAX_LIVES);
    ev = await game.settle(await game.dropOnDog('vida'));
    expect(ev.lives, 'não passa de MAX_LIVES').toBe(MAX_LIVES);
    await expect(page.locator('.cachorro-loko .lives img')).toHaveCount(MAX_LIVES);
    expect(ev.score).toBe(3);

    ev = await game.settle(await game.dropOnDog('dobro'));
    expect(ev).toMatchObject({ points: 1, dobro: false, score: 4 });
    await expect(page.locator('.cachorro-loko .power')).toHaveText(`×2 ${POWER_DURATION.dobro}s`);
    ev = await game.settle(await game.dropOnDog('normal'));
    expect(ev).toMatchObject({ points: 2, dobro: true, score: 6 });
    await expect(page.locator('.cachorro-loko .score')).toHaveText('ENTREGAS 006');
    // pré-condição: uma vida a menos, para a caixa de vida ter efeito durante o dobro
    await game.setLives(MAX_LIVES - 1);
    ev = await game.settle(await game.dropOnDog('vida'));
    expect(ev).toMatchObject({ points: 2, score: 8, lives: MAX_LIVES });
    await game.frames(POWER_DURATION.dobro * FPS + 1);
    ev = await game.settle(await game.dropOnDog('normal'));
    expect(ev).toMatchObject({ points: 1, dobro: false, score: 9 });
  });
});
