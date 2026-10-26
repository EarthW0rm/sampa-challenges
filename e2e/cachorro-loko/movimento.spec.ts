import { DOG_MAX_X, DOG_MIN_X, DOG_SPEED } from '../../src/games/cachorro-loko/game/constants';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — movimento', () => {
  test('CL-RN-02 CL-RN-03 anda DOG_SPEED px/s com setas e A/D, vira, para ao soltar e não passa dos limites', async ({ game, page }) => {
    await game.play();
    // pré-condição: chapeiro parado, para nenhum pacote cair e tirar vida durante o teste
    await game.chef(false);
    const x0 = (await game.state()).dog.x;

    await game.walk('right', FPS / 2);
    let s = await game.state();
    expect(s.dog.x - x0).toBeCloseTo(DOG_SPEED / 2, 6);
    expect(s.dog.facing).toBe(1);

    // 1 s para a esquerda com A: DOG_SPEED px
    await game.walk('left', FPS, 'ad');
    s = await game.state();
    expect(s.dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);
    expect(s.dog.facing).toBe(-1);

    // soltou: para na hora
    await game.frames(30);
    expect((await game.state()).dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);

    // as duas direções juntas se anulam (sem virar)
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('KeyA');
    await game.frames(30);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('KeyA');
    s = await game.state();
    expect(s.dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);
    expect(s.dog.facing).toBe(-1);

    await game.walk('left', 5 * FPS);
    expect((await game.state()).dog.x).toBe(DOG_MIN_X);
    await game.walk('right', 5 * FPS, 'ad');
    expect((await game.state()).dog.x).toBe(DOG_MAX_X);
  });

  test('CL-RN-04 segurar a metade direita/esquerda do palco anda; soltar para', async ({ game }) => {
    await game.play();
    // pré-condição: chapeiro parado (só o movimento importa aqui)
    await game.chef(false);
    const x0 = (await game.state()).dog.x;
    await game.touch('right', FPS / 2);
    let s = await game.state();
    expect(s.dog.x - x0).toBeCloseTo(DOG_SPEED / 2, 6);
    expect(s.dog.facing).toBe(1);
    await game.touch('left', FPS);
    s = await game.state();
    expect(s.dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);
    expect(s.dog.facing).toBe(-1);
    await game.frames(30);
    expect((await game.state()).dog.x - x0).toBeCloseTo(-DOG_SPEED / 2, 6);
  });
});
