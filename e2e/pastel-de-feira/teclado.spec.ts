import { HOLD_MILL_MANUAL } from '../../src/games/pastel-de-feira/game/constants';
import { expect, test } from './support/game';

/** RN-174: atalhos de teclado do desktop. */
test.describe('Teclado', () => {
  test.beforeEach(async ({ game }) => {
    await game.startDay();
  });

  const arrive = (game: import('./support/game').GamePage, s: string) =>
    game.advanceUntil((pf, st) => pf.sim.state.pasteleiro.to === null && pf.sim.state.pasteleiro.at === st && pf.env.ui.panel === st, 5, s, 1);

  test('números 1–4 levam às estações na ordem da barraca (balcão, bancada, tacho, moenda)', async ({ game, page }) => {
    const order = ['balcao', 'bancada', 'tacho1', 'moenda'];
    for (const [i, s] of [[2, 'bancada'], [3, 'tacho1'], [4, 'moenda'], [1, 'balcao']] as const) {
      await page.keyboard.press(`Digit${i}`);
      await game.frames(1);
      await arrive(game, s);
      expect(order[i - 1]).toBe(s);
    }
  });

  test('número sem estação (9) não faz nada', async ({ game, page }) => {
    await page.keyboard.press('Digit9');
    await game.frames(5);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBeNull();
  });

  test('Esc recolhe o painel', async ({ game, page }) => {
    await page.keyboard.press('Digit2');
    await game.frames(1);
    await arrive(game, 'bancada');
    await page.keyboard.press('Escape');
    await game.frames(1);
    expect(await game.hook((pf) => pf.env.ui.panel)).toBeNull();
  });

  test('Enter ativa o controle em foco (ANOTAR é o primeiro do balcão)', async ({ game, page }) => {
    await game.waitCustomer();
    await page.keyboard.press('Digit1');
    await game.frames(1);
    await arrive(game, 'balcao');
    await page.keyboard.press('Enter');
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.customers.some((c) => c.state === 'anotado'))).toBe(true);
  });

  test('setas movem o foco entre os controles do painel', async ({ game, page }) => {
    await page.keyboard.press('Digit1');
    await game.frames(1);
    await arrive(game, 'balcao');
    await page.keyboard.press('ArrowRight');
    await game.frames(1);
    expect(await game.hook((pf) => pf.env.ui.focus)).toBe(1);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await game.frames(1);
    const n = await game.hook((pf) => pf.controls().length);
    expect(await game.hook((pf) => pf.env.ui.focus)).toBe(n - 1);
  });

  test('segurar Espaço na moenda extrai o caldo; soltar para', async ({ game, page }) => {
    await page.keyboard.press('Digit4');
    await game.frames(1);
    await arrive(game, 'moenda');
    await page.keyboard.down('Space');
    await game.frames(Math.round(HOLD_MILL_MANUAL * 60) + 2);
    await page.keyboard.up('Space');
    await game.frames(1);
    expect(await game.hook((pf) => ({ cups: pf.sim.state.cups.length, hold: pf.sim.state.pasteleiro.hold }))).toEqual({ cups: 1, hold: null });
  });

  test('auto-repeat do Enter não age em dobro', async ({ game, page }) => {
    await game.advanceUntil((pf) => pf.sim.state.customers.length >= 2, 120);
    await page.keyboard.press('Digit1');
    await game.frames(1);
    await arrive(game, 'balcao');
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter'); // repetição do sistema
    await page.keyboard.up('Enter');
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.customers.filter((c) => c.state === 'anotado').length)).toBe(1);
  });

  test('M liga e desliga o som e a música juntos (HUD reflete)', async ({ page }) => {
    const som = page.getByRole('button', { name: 'Efeitos sonoros' });
    const musica = page.getByRole('button', { name: 'Música' });
    await expect(som).toHaveText('Som: não');
    await page.keyboard.press('KeyM');
    await expect(som).toHaveText('Som: sim');
    await expect(musica).toHaveText('Música: sim');
    await page.keyboard.press('KeyM');
    await expect(som).toHaveText('Som: não');
    await expect(musica).toHaveText('Música: não');
  });

  test('RN-172: o mudo fica guardado entre sessões', async ({ page }) => {
    await page.getByRole('button', { name: 'Efeitos sonoros' }).click();
    expect(await page.evaluate(() => localStorage.getItem('pastel-de-feira:som'))).toBe('on');
    expect(await page.evaluate(() => localStorage.getItem('pastel-de-feira:musica'))).toBe('off');
  });

  test('teclas com Ctrl/Cmd não são capturadas pelo jogo', async ({ game, page }) => {
    await page.keyboard.press('Control+Digit3');
    await game.frames(5);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBeNull();
  });
});
