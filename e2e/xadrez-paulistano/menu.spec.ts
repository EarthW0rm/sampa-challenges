import { DEFAULT_LEVEL, LEVEL_MAX, LEVEL_MIN } from '../../src/games/xadrez-paulistano/game/constants';
import { levelLabel, levelProfile } from '../../src/games/xadrez-paulistano/game/levels';
import { readStorage } from '../support/storage';
import { expect, test } from './support/test';

/** Mesmo texto da dica do menu (`Menu.tsx`), calculado do perfil do nível. */
function hint(level: number): string {
  const p = levelProfile(level);
  const time = (p.timeMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const depth = level >= LEVEL_MAX ? 'o mais fundo que der' : `${p.depth} ${p.depth === 1 ? 'lance' : 'lances'} à frente`;
  const extras = [p.noise ? 'erra a avaliação de propósito' : '', p.blunder >= 0.01 ? `${Math.round(p.blunder * 100)}% de lances sem pensar` : ''].filter(Boolean).join(', ');
  return `Pensa até ${time} s, ${depth}${extras ? `; ${extras}` : ''}.`;
}

test.describe('Xadrez Paulistano — menu', () => {
  test('XP-RN-29 XP-RN-27 opções: nível com limites, faixas e dica; cor só contra o computador; nomes até 14', async ({ game, page }) => {
    await game.open();
    const num = page.locator('.xadrez-paulistano .level-num');
    const name = page.locator('.xadrez-paulistano .level-name');
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvc]')).toBeChecked();
    await expect(num).toHaveText(String(DEFAULT_LEVEL));
    await expect(page.locator('.xadrez-paulistano .level-hint')).toHaveText(hint(DEFAULT_LEVEL));
    for (const lv of [1, 20, 21, 40, 41, 60, 61, 80, 81, 99, 100]) {
      await page.locator('#xadrez-level').fill(String(lv));
      await expect(name).toHaveText(levelLabel(lv));
      await expect(page.locator('.xadrez-paulistano .level-hint')).toHaveText(hint(lv));
    }
    await game.evidence('Faixas conferidas');
    await game.ev.quiet(() => page.getByRole('button', { name: 'Aumentar nível' }).click());
    await expect(num, 'para no máximo').toHaveText(String(LEVEL_MAX));
    await game.menu({ level: LEVEL_MIN });
    await game.ev.quiet(() => page.getByRole('button', { name: 'Diminuir nível' }).click());
    await expect(num, 'para no mínimo').toHaveText(String(LEVEL_MIN));
    await game.ev.quiet(() => page.getByRole('button', { name: 'Aumentar nível' }).click());
    await game.ev.action('Botões − e +');
    await expect(num).toHaveText(String(LEVEL_MIN + 1));
    await expect(page.locator('.xadrez-paulistano .card-piece')).toHaveCount(3);
    await expect(page.getByText('Seu nome')).toBeVisible();

    await game.menu({ mode: 'pvp' });
    await expect(page.locator('.xadrez-paulistano .card-piece'), 'cor só contra o computador').toHaveCount(0);
    await expect(page.locator('.xadrez-paulistano .level-num')).toHaveCount(0);
    await expect(page.getByLabel('Girar o tabuleiro para quem vai jogar')).toBeVisible();
    const fields = page.locator('.xadrez-paulistano .field input');
    await fields.nth(0).fill('ABCDEFGHIJKLMNOPQRST');
    await expect(fields.nth(0), 'até 14 caracteres').toHaveValue('ABCDEFGHIJKLMN');
    await game.menu({ names: ['   ', '  Bia  '] });
    await game.play();
    expect((await game.state()).names, 'vazio vira padrão; pontas cortadas').toEqual(['Jogador 1', 'Bia']);
    await game.press('← Menu');
    await game.menu({ mode: 'pvc' });
    await expect(num, 'o nível fica guardado ao trocar de modo').toHaveText(String(LEVEL_MIN + 1));
    await game.menu({ level: 45 });
    await game.play();
    await expect(page.locator('.xadrez-paulistano .mode-label')).toHaveText(`Contra o computador · nível 45 (${levelLabel(45)})`);
  });

  test('XP-RN-30 escolhas gravadas e config corrompida normalizada', async ({ game, page }) => {
    await game.open({ rawStorage: { 'xadrez-paulistano:config': '{quebrado' } });
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvc]'), 'JSON inválido: padrões').toBeChecked();
    await expect(page.locator('.xadrez-paulistano .level-num')).toHaveText(String(DEFAULT_LEVEL));
    await game.menu({ mode: 'pvp', names: ['Ana', 'Bia'], autoFlip: true });
    await game.play();
    expect(JSON.parse((await readStorage(page, 'xadrez-paulistano:config')) ?? 'null')).toEqual({
      mode: 'pvp',
      level: DEFAULT_LEVEL,
      color: 'white',
      names: ['Ana', 'Bia'],
      autoFlip: true,
    });
    await page.reload();
    await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvp]')).toBeChecked();
    await expect(page.locator('.xadrez-paulistano .field input').nth(1)).toHaveValue('Bia');
    await expect(page.getByLabel('Girar o tabuleiro para quem vai jogar')).toBeChecked();
    await game.evidence('Escolhas gravadas de volta no menu');

    const cases: [string, number][] = [
      ['{"mode":"x","level":0,"color":"verde","names":["A"],"autoFlip":1}', DEFAULT_LEVEL],
      ['{"level":500}', LEVEL_MAX],
      ['{"level":-5}', LEVEL_MIN],
      ['{"level":"abc"}', DEFAULT_LEVEL],
      ['{"level":42.6}', 43],
    ];
    for (const [raw, level] of cases) {
      await page.evaluate((v) => localStorage.setItem('xadrez-paulistano:config', v), raw);
      await page.reload();
      await expect(page.locator('.xadrez-paulistano input[name=mode][value=pvc]'), raw).toBeChecked();
      await expect(page.locator('.xadrez-paulistano .level-num'), raw).toHaveText(String(level));
      await game.evidence(`Config ${raw}`);
    }
    // o primeiro caso: cor desconhecida → brancas; nome que falta → padrão
    await page.evaluate(() => localStorage.setItem('xadrez-paulistano:config', '{"mode":"pvp","color":"verde","names":["A"],"autoFlip":1}'));
    await page.reload();
    await expect(page.locator('.xadrez-paulistano .field input').nth(1)).toHaveValue('Jogador 2');
    await expect(page.getByLabel('Girar o tabuleiro para quem vai jogar')).toBeChecked();
    await game.menu({ mode: 'pvc' });
    await expect(page.locator('.xadrez-paulistano input[name=color][value=white]')).toBeChecked();
  });
});
