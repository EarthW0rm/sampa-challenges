import { AIM_FINE_DEG, AIM_STEP_DEG, DEFAULT_POWER, MAX_SPEED, POWER_STEP, STROKE_S } from '../../src/games/sinuca-de-bar/game/constants';
import { expect, test } from './support/test';

const deg = (rad: number) => (rad * 180) / Math.PI;
const near = (a: number, b: number, tol = 0.6) => Math.abs(a - b) <= tol;

test.describe('Sinuca de Bar — mira, força e tacada', () => {
  test('SB-RN-04 SB-RN-08 mira por toque e arraste; linhas de mira mostram bola permitida, proibida ou tabela', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    let s = await game.state();
    const cue = s.balls[0];
    expect(s.aim, 'na saída a mira aponta para a direita').toBe(0);
    expect(s.guide.ball, 'a linha da saída encontra o triângulo').not.toBeNull();
    expect(s.guide.legal, 'mesa aberta: a bola da frente pode ser tocada').toBe(true);

    await game.aimAt(cue.x, cue.y - 40);
    expect(near(deg((await game.state()).aim), -90)).toBe(true);
    // toque a menos de 2 px da branca não muda a mira
    await game.aimAt(cue.x + 1, cue.y);
    expect(near(deg((await game.state()).aim), -90)).toBe(true);
    await game.dragFromTo({ x: 200, y: 60 }, { x: cue.x, y: 180 }, 8);
    s = await game.state();
    expect(near(deg(s.aim), 90), `arraste: mira final para baixo (${deg(s.aim)})`).toBe(true);
    expect(s.guide.ball, 'para baixo só há tabela').toBeNull();

    // pré-condição rara: grupos definidos (lisas para o jogador 1) e uma listrada na reta da branca
    await game.setTable([{ n: 0, x: 100, y: 112 }, { n: 9, x: 150, y: 112 }, { n: 1, x: 250, y: 60 }, { n: 8, x: 250, y: 160 }], { groups: ['A', 'B'] });
    await game.aimToward(150, 112);
    s = await game.state();
    expect(s.guide).toMatchObject({ ball: 9, legal: false });
    await game.aimToward(250, 60);
    expect((await game.state()).guide).toMatchObject({ ball: 1, legal: true });
  });

  test('SB-RN-05 botões ◀ ‹ › ▶ e teclado (Shift = fino) giram a mira', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    const aim = async () => deg((await game.state()).aim);
    const steps: [Parameters<typeof game.nudgeAim>[0], number][] = [
      ['left', -AIM_STEP_DEG],
      ['fineLeft', -AIM_FINE_DEG],
      ['fineRight', AIM_FINE_DEG],
      ['right', AIM_STEP_DEG],
    ];
    for (const [b, d] of steps) {
      const a0 = await aim();
      await game.nudgeAim(b);
      expect(await aim()).toBeCloseTo(a0 + d, 6);
    }
    await page.locator('.sinuca-de-bar .hint').click();
    let a0 = await aim();
    await game.pressKey('ArrowRight');
    expect(await aim()).toBeCloseTo(a0 + AIM_STEP_DEG, 6);
    a0 = await aim();
    await game.pressKey('Shift+ArrowLeft');
    expect(await aim()).toBeCloseTo(a0 - AIM_FINE_DEG, 6);
    a0 = await aim();
    await game.pressKey('ArrowLeft');
    expect(await aim()).toBeCloseTo(a0 - AIM_STEP_DEG, 6);
  });

  test('SB-RN-06 força: barra de 5% a 100%, ↑/↓ em passos e limites', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    expect((await game.state()).power).toBe(DEFAULT_POWER);
    await expect(page.getByText(`Força ${Math.round(DEFAULT_POWER * 100)}%`)).toBeVisible();
    await game.power(100);
    expect((await game.state()).power).toBe(1);
    await page.locator('.sinuca-de-bar .hint').click();
    await game.pressKey('ArrowUp');
    expect((await game.state()).power, 'para no 100%').toBe(1);
    await game.pressKey('ArrowDown');
    expect((await game.state()).power).toBeCloseTo(1 - POWER_STEP, 9);
    await game.power(5);
    await page.locator('.sinuca-de-bar .hint').click();
    await game.pressKey('ArrowDown');
    expect((await game.state()).power, 'para no 5%').toBeCloseTo(0.05, 9);
    await game.pressKey('ArrowUp');
    expect((await game.state()).power).toBeCloseTo(0.05 + POWER_STEP, 9);
  });

  test('SB-RN-07 SB-RN-09 tacada: animação, bola rolando, encaçapa no raio e a força continua', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara: bola 3 na reta da caçapa do meio de cima, mesa aberta
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 3, x: 160, y: 60 }, { n: 9, x: 250, y: 150 }]);
    await game.aimToward(160, 60);
    await game.power(40);
    await expect(game.shootButton).toBeEnabled();
    await game.shoot();
    await game.frames(1);
    expect((await game.state()).phase).toBe('stroke');
    await game.frames(Math.ceil(STROKE_S * 60));
    let s = await game.state();
    expect(s.phase).toBe('rolling');
    expect(s.balls[0].y, `a branca saiu para cima (até ${0.4 * MAX_SPEED} px/s)`).toBeLessThan(120);
    await expect(game.shootButton).toBeDisabled();
    await expect(page.getByText('Bolas rolando…')).toBeVisible();
    s = await game.settle(s.shots);
    expect(s.lastShot).toMatchObject({ firstHit: 3, pocketed: [3], foul: null, again: true });
    expect(s.balls.find((b) => b.n === 3)!.on).toBe(false);
    expect(s.balls.every((b) => !b.moving), 'tudo parado').toBe(true);
    expect(s.power, 'força continua a mesma').toBe(0.4);
    // continua a vez: Espaço também taca
    await page.locator('.sinuca-de-bar .hint').click();
    await game.pressKey('Space');
    expect((await game.state()).phase).toBe('stroke');
  });
});
