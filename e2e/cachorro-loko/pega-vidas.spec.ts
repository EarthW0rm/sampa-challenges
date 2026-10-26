import { BOX_SIZE, CATCH_RECT, DIZZY_TIME, DOG_FRAME, DOG_Y, GROUND_Y, START_LIVES, W } from '../../src/games/cachorro-loko/game/constants';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — pega, pontos e vidas', () => {
  test('CL-RN-10 CL-RN-11 CL-RN-12 CL-RN-30 pega pelo baú e pelo corpo, olhando para os dois lados; pacote no asfalto ou na lateral tira vida', async ({ game, page }) => {
    await game.play();
    // pré-condição: chapeiro parado; os pacotes do teste são postos na rua pelo prepare
    await game.chef(false);

    // área de pega = CATCH_RECT sobre o quadro do cachorro, olhando para a direita
    let s = await game.state();
    expect(s.catchRect).toEqual({ x: s.dog.x + CATCH_RECT.x, y: DOG_Y + CATCH_RECT.y, w: CATCH_RECT.w, h: CATCH_RECT.h });

    // pacote na rua caindo em cima da ponta da frente da área (baú)
    let id = await game.dropAt('normal', s.catchRect.x + s.catchRect.w - BOX_SIZE / 2);
    let ev = await game.settle(id);
    expect(ev).toMatchObject({ ev: 'catch', points: 1, score: 1, lives: START_LIVES });
    await expect(page.locator('.cachorro-loko .score')).toHaveText('ENTREGAS 001');

    // vira para a esquerda: a área espelha dentro do quadro
    await game.walk('left', 10);
    s = await game.state();
    expect(s.catchRect.x).toBeCloseTo(s.dog.x + DOG_FRAME - CATCH_RECT.x - CATCH_RECT.w, 6);
    // pacote no lado de trás do quadro (corpo), só coberto pela área espelhada
    id = await game.dropAt('normal', s.catchRect.x + s.catchRect.w - BOX_SIZE);
    ev = await game.settle(id);
    expect(ev).toMatchObject({ ev: 'catch', score: 2 });

    // pacote longe do cachorro: toca o asfalto e tira uma vida
    id = await game.dropAt('normal', s.dog.x > W / 2 ? 10 : W - 30);
    ev = await game.settle(id);
    expect(ev.ev).toBe('land');
    expect(ev.y + BOX_SIZE).toBeGreaterThanOrEqual(GROUND_Y);
    expect(ev).toMatchObject({ score: 2, lives: START_LIVES - 1 });
    await expect(page.locator('.cachorro-loko .lives')).toHaveAttribute('aria-label', `${START_LIVES - 1} vidas`);
    await expect(page.locator('.cachorro-loko .lives img')).toHaveCount(3);

    // pacote saindo pela lateral direita também conta como perdido
    id = await game.dropAt('normal', W - BOX_SIZE, 20, 200);
    ev = await game.settle(id);
    expect(ev).toMatchObject({ ev: 'land', lives: START_LIVES - 2 });
    expect(ev.x).toBeGreaterThan(W);
    await game.evidence('Duas vidas perdidas: asfalto e lateral');
  });

  test('CL-RN-13 bomba pega tira vida e deixa tonto DIZZY_TIME (não anda, mas pega); bomba no chão explode sem dano', async ({ game }) => {
    await game.play();
    // pré-condição: chapeiro parado; bombas e pacotes postos pelo prepare
    await game.chef(false);
    let id = await game.dropOnDog('bomba');
    let ev = await game.settle(id);
    expect(ev).toMatchObject({ ev: 'catch', kind: 'bomba', points: 0, score: 0, lives: START_LIVES - 1 });
    let s = await game.state();
    expect(s.dog.dizzy).toBeGreaterThan(DIZZY_TIME - 0.1);
    expect(s.dog.dizzy).toBeLessThanOrEqual(DIZZY_TIME);
    const x = s.dog.x;
    await game.walk('right', 20);
    s = await game.state();
    expect(s.dog.x, 'tonto não anda').toBe(x);

    // ainda tonto, a área de pega vale
    id = await game.dropOnDog('normal', 140);
    ev = await game.settle(id);
    expect(ev).toMatchObject({ ev: 'catch', score: 1 });
    expect(ev.t).toBeLessThan((await game.events()).find((e) => e.kind === 'bomba' && e.ev === 'catch')!.t + DIZZY_TIME);

    await game.frames(FPS);
    expect((await game.state()).dog.dizzy).toBe(0);
    await game.walk('right', 20);
    expect((await game.state()).dog.x, 'passou a tontura, anda').toBeGreaterThan(x);

    // bomba que cai no asfalto não tira vida
    id = await game.dropAt('bomba', 10);
    ev = await game.settle(id);
    expect(ev).toMatchObject({ ev: 'land', kind: 'bomba', lives: START_LIVES - 1 });
    await game.evidence('Bomba explodiu no asfalto sem dano');
  });
});
