import { ANGLE_MAX, ANGLE_MIN, VELOCITY_MAX, VELOCITY_MIN } from '../../src/games/capacete-voador/game/constants';
import { expect, test } from './support/test';

test.describe('Capacete Voador — mira', () => {
  test('CV-RN-08 CV-RN-26 formulário: foco no ângulo, 45/50, teclado e botão, cada jogador no seu painel com o último tiro', async ({ game, page }) => {
    await game.play({ mode: 'pvp' });
    await expect(game.angleInput(0)).toBeFocused();
    await expect(game.angleInput(0)).toHaveValue('45');
    await expect(game.velocityInput(0)).toHaveValue('50');
    await expect(game.panel(0)).toHaveClass(/active/);
    await expect(game.panel(1).locator('.aim-form')).toHaveCount(0);

    // só teclado: o texto do ângulo já vem selecionado, Tab leva à velocidade (também selecionada), Enter lança
    const b1 = await game.harmless(0);
    await page.keyboard.type(String(b1.angle));
    await page.keyboard.press('Tab');
    await page.keyboard.type(String(b1.velocity));
    await expect(game.angleInput(0)).toHaveValue(String(b1.angle));
    await expect(game.velocityInput(0)).toHaveValue(String(b1.velocity));
    await page.keyboard.press('Enter');
    await game.frames(1);
    expect((await game.state()).phase).toBe('flying');
    let s = await game.waitShot();
    expect(s.lastShots[0]).toEqual({ angle: b1.angle, velocity: b1.velocity });

    // vez do jogador 2: formulário no painel da direita, com 45/50, e lança pelo botão
    expect(s.turn).toBe(1);
    await expect(game.panel(1)).toHaveClass(/active/);
    await expect(game.panel(0).locator('.aim-form')).toHaveCount(0);
    await expect(game.panel(0).locator('.last-shot')).toHaveText(`Último: ${b1.angle}° / ${b1.velocity}`);
    await expect(game.angleInput(1)).toHaveValue('45');
    await expect(game.velocityInput(1)).toHaveValue('50');
    const b2 = await game.harmless(1);
    s = await game.shoot(b2.angle, b2.velocity, 1, 'botao');
    expect(s.lastShots[1]).toEqual({ angle: b2.angle, velocity: b2.velocity });

    // de volta ao jogador 1: o formulário traz o último tiro dele
    expect(s.turn).toBe(0);
    await expect(game.angleInput(0)).toHaveValue(String(b1.angle));
    await expect(game.velocityInput(0)).toHaveValue(String(b1.velocity));
    await expect(game.panel(1).locator('.last-shot')).toHaveText(`Último: ${b2.angle}° / ${b2.velocity}`);
  });

  test('CV-RN-09 limites: fora de 0–180 / 1–200 ou com decimais o navegador recusa; os extremos lançam', async ({ game }) => {
    await game.play({ mode: 'practice' });
    const bad: [string, string][] = [
      [String(ANGLE_MAX + 1), '50'],
      ['-5', '50'],
      ['45.5', '50'],
      ['45', String(VELOCITY_MAX + 1)],
      ['45', String(VELOCITY_MIN - 1 - 0.5)],
    ];
    for (const [a, v] of bad) {
      await game.aim(a, v);
      await game.fire('enter');
      const s = await game.state();
      expect(s.phase, `ângulo ${a}, velocidade ${v}`).toBe('aiming');
      expect(s.shotsFired).toBe(0);
      const msg = await game.page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('.capacete-voador .aim-form input')].map((i) => i.validationMessage).join(''));
      expect(msg, 'balão de validação do navegador').not.toBe('');
    }
    await game.aim(ANGLE_MAX, VELOCITY_MAX);
    await game.fire('botao');
    let s = await game.state();
    expect(s.phase).toBe('flying');
    expect(s.lastShots[0]).toEqual({ angle: ANGLE_MAX, velocity: VELOCITY_MAX });
    s = await game.waitShot();
    await game.waitAim(0);
    await game.aim(ANGLE_MIN, VELOCITY_MIN);
    await game.fire();
    expect((await game.state()).lastShots[0]).toEqual({ angle: ANGLE_MIN, velocity: VELOCITY_MIN });
  });

  test('CV-RN-10 entradas inválidas: letras não entram (apagam a seleção), velocidade vazia dá erro, ângulo vazio vale 0', async ({ game, page }) => {
    await game.play({ mode: 'practice' });
    await expect(game.angleInput(0)).toBeFocused();
    // com o texto selecionado, a tecla recusada apaga a seleção
    await page.keyboard.type('abc,;');
    expect(await game.angleInput(0).inputValue(), 'seleção apagada, letras descartadas').toBe('');
    // com o cursor no fim, as letras são só descartadas
    await game.angleInput(0).fill('45');
    await game.angleInput(0).press('End');
    await page.keyboard.type('abc,;');
    expect(await game.angleInput(0).inputValue(), 'letras e símbolos descartados').toBe('45');

    await game.aim('45', '');
    await game.fire('enter');
    await expect(page.getByRole('alert')).toHaveText(`Velocidade entre ${VELOCITY_MIN} e ${VELOCITY_MAX}`);
    expect((await game.state()).phase).toBe('aiming');

    await game.aim('', '30');
    await game.fire('enter');
    const s = await game.state();
    expect(s.phase, 'ângulo vazio lança').toBe('flying');
    expect(s.lastShots[0]).toEqual({ angle: 0, velocity: 30 });
    await game.waitShot();
  });
});
