import { DEFAULT_GRAVITY } from '../../src/games/capacete-voador/game/constants';
import { expect, test } from './support/test';

test.describe('Capacete Voador — menu', () => {
  test('CV-RN-01 CV-RN-02 valores padrão e campos que dependem do modo', async ({ game, page }) => {
    await game.open();
    const card = (t: string) => page.locator('.capacete-voador .card', { hasText: t });
    await expect(card('Contra o computador')).toHaveClass(/selected/);
    await expect(card('Médio')).toHaveClass(/selected/);
    await expect(page.getByLabel('Nome do jogador 1')).toHaveValue('Jogador 1');
    await expect(page.getByLabel('Adversário')).toHaveValue('Computador');
    await expect(page.getByLabel('Adversário')).toBeDisabled();
    await expect(page.getByLabel('Pontos para vencer')).toHaveValue('3');
    await expect(page.getByLabel('Gravidade (m/s²)')).toHaveValue(String(DEFAULT_GRAVITY));
    await expect(page.locator('.capacete-voador .chip', { hasText: 'Terra' })).toHaveClass(/selected/);
    await expect(page.getByLabel('Garoa (só visual)')).not.toBeChecked();

    await game.menu({ mode: 'pvp' });
    await expect(page.getByText('Dificuldade do computador')).toHaveCount(0);
    await expect(page.getByLabel('Nome do jogador 2')).toBeEnabled();
    await expect(page.getByLabel('Nome do jogador 2')).toHaveValue('Jogador 2');
    await expect(page.getByLabel('Pontos para vencer')).toBeVisible();

    await game.menu({ mode: 'practice' });
    await expect(page.getByText('Dificuldade do computador')).toHaveCount(0);
    await expect(page.getByLabel('Adversário')).toHaveValue('Motoboy-alvo');
    await expect(page.getByLabel('Adversário')).toBeDisabled();
    await expect(page.getByLabel('Pontos para vencer')).toHaveCount(0);

    await game.menu({ mode: 'pvc' });
    await expect(page.getByText('Dificuldade do computador')).toBeVisible();
    await game.start();
    const s = await game.state();
    expect(s).toMatchObject({ mode: 'pvc', difficulty: 'medio', names: ['Jogador 1', 'Computador'], pointsToWin: 3, gravity: DEFAULT_GRAVITY, rain: false });
  });

  test('CV-RN-03 nomes: até 14 caracteres, aparados, vazio vira o padrão', async ({ game, page }) => {
    await game.open();
    await game.menu({ mode: 'pvp' });
    const n1 = page.getByLabel('Nome do jogador 1');
    await n1.fill('');
    await n1.pressSequentially('  Ana Paulista da Silva');
    await expect(n1, 'o campo corta em 14 caracteres').toHaveValue('  Ana Paulista');
    await page.getByLabel('Nome do jogador 2').fill('   ');
    await game.start();
    const s = await game.state();
    expect(s.names).toEqual(['Ana Paulista', 'Jogador 2']);
    await expect(game.panel(0).locator('h2')).toHaveText('Ana Paulista');
    await expect(game.panel(1).locator('h2')).toHaveText('Jogador 2');
  });

  test('CV-RN-04 pontos para vencer de 1 a 10', async ({ game, page }) => {
    await game.open();
    const opts = await page.getByLabel('Pontos para vencer').locator('option').allTextContents();
    expect(opts.map(Number)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    await game.menu({ points: 10 });
    await game.start();
    expect((await game.state()).pointsToWin).toBe(10);
  });

  test('CV-RN-05 gravidade: atalhos, valor fora do limite ou do passo é recusado e apagar vira 0 (recusado)', async ({ game, page }) => {
    await game.open();
    const g = page.getByLabel('Gravidade (m/s²)');
    await game.menu({ gravityChip: 'Lua' });
    await expect(g).toHaveValue('1.6');
    await expect(page.locator('.capacete-voador .chip', { hasText: 'Lua' })).toHaveClass(/selected/);
    await game.start();
    expect((await game.state()).gravity).toBe(1.6);
    await game.backToMenu();
    await expect(g, 'o menu volta com a última escolha').toHaveValue('1.6');

    for (const bad of ['60', '0.2', '2.55']) {
      await g.fill(bad);
      await game.startButton.click();
      await expect(game.startButton, `gravidade ${bad} recusada`).toBeVisible();
      expect(await g.evaluate((e: HTMLInputElement) => e.validationMessage), `balão de validação para ${bad}`).not.toBe('');
      expect(await game.hasHook()).toBe(false);
    }

    await game.menu({ gravity: '' });
    await expect(g, 'apagar o campo mostra 0').toHaveValue('0');
    await game.startButton.click();
    await expect(game.startButton, 'gravidade 0 recusada').toBeVisible();

    await game.menu({ gravityChip: 'Júpiter' });
    await expect(g).toHaveValue('24.8');
    await game.start();
    expect((await game.state()).gravity).toBe(24.8);
  });

  test('CV-RN-06 garoa liga só a camada visual', async ({ game }) => {
    await game.play({ rain: true });
    const s = await game.state();
    expect(s.rain).toBe(true);
    expect(s.gravity).toBe(DEFAULT_GRAVITY);
    await game.evidence('Garoa ligada');
  });

  test('CV-RN-07 barra: rótulo do modo e da rodada, ← Menu mantém as opções, Reiniciar zera', async ({ game, page }) => {
    await game.play({ mode: 'pvp', names: ['Ana', 'Bia'], points: 5 });
    const label = page.locator('.capacete-voador .mode-label');
    await expect(label).toHaveText('2 jogadores · rodada 1');
    // rodada 1 acaba com o jogador 1 acertando a própria cabeça
    const self = await game.findShotOrRestart({ kind: 'pilot', index: 0, player: 0 });
    await game.shoot(self.angle, self.velocity, 0);
    await game.waitRound(2);
    await expect(label).toHaveText('2 jogadores · rodada 2');
    const before = await game.state();
    expect(before.scores).toEqual([0, 1]);
    expect(before.lastShots[0]).not.toBeNull();

    await game.restart();
    const after = await game.state();
    expect(after).toMatchObject({ round: 1, scores: [0, 0], turn: 0, lastShots: [null, null], shotsFired: 0 });
    expect(after.buildings, 'cidade nova').not.toEqual(before.buildings);
    await expect(label).toHaveText('2 jogadores · rodada 1');

    await game.backToMenu();
    await expect(page.locator('.capacete-voador .card', { hasText: '2 jogadores' })).toHaveClass(/selected/);
    await expect(page.getByLabel('Nome do jogador 1')).toHaveValue('Ana');
    await expect(page.getByLabel('Pontos para vencer')).toHaveValue('5');
    await game.menu({ mode: 'pvc', difficulty: 'dificil' });
    await game.start();
    await expect(label).toHaveText('Contra o computador · difícil · rodada 1');
  });
});
