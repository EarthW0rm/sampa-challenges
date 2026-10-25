/** Executa os passos da estratégia (`strategy.ts`) pelas abas do Preparo, como o jogador faria. */
import type { Campaign } from '../../../src/games/pastel-de-feira/game/campaign/types';
import { PRICE_STEP } from '../../../src/games/pastel-de-feira/game/constants';
import { SAVE_KEY } from './campaign';
import { expect, type GamePage } from './game';
import type { PrepStep } from './strategy';

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function readSave(game: GamePage): Promise<{ phase: string; campaign: Campaign }> {
  return game.page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
}

async function tab(game: GamePage, name: string): Promise<void> {
  const t = game.page.getByRole('tab', { name, exact: true });
  if ((await t.getAttribute('aria-selected')) !== 'true') await t.click();
}

/** Linha de lista cujo título (strong) é exatamente `name`. */
function row(game: GamePage, name: string) {
  const page = game.page;
  return page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong').getByText(name, { exact: true }) }).first();
}

/** Clica `n` vezes num botão do seletor de quantidade. */
async function clickTimes(loc: ReturnType<GamePage['page']['locator']>, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await loc.click();
}

export async function applyPrep(game: GamePage, steps: readonly PrepStep[]): Promise<void> {
  const page = game.page;
  for (const s of steps) {
    switch (s.k) {
      case 'buy': {
        await tab(game, 'Melhorias');
        await row(game, s.name).getByRole('button', { name: money(s.price) }).click();
        break;
      }
      case 'hire': {
        await tab(game, 'Equipe');
        await row(game, `${s.name} · ${s.kind}`).getByRole('button', { name: /^Contratar/ }).click();
        break;
      }
      case 'menu': {
        await tab(game, 'Cardápio');
        const box = row(game, s.name).getByRole('checkbox');
        if (s.on) await box.check();
        else await box.uncheck();
        break;
      }
      case 'price': {
        await tab(game, 'Cardápio');
        const r = row(game, s.name);
        const n = Math.round((s.to - s.from) / PRICE_STEP);
        await clickTimes(r.getByRole('button', { name: n > 0 ? 'Subir preço' : 'Baixar preço' }), Math.abs(n));
        await expect(r.locator('.stepper span')).toHaveText(money(s.to));
        break;
      }
      case 'suggested': {
        await tab(game, 'Insumos');
        await page.getByRole('button', { name: 'Usar sugerida' }).click();
        await page.getByRole('button', { name: /^Comprar tudo/ }).click();
        await expect(page.locator('.pastel-de-feira .tab .warn[role="status"]')).toHaveCount(0);
        break;
      }
      case 'ingredient':
      case 'consumable': {
        await tab(game, 'Insumos');
        const r = row(game, s.name);
        await clickTimes(r.getByRole('button', { name: 'Aumentar' }), s.qty / (s.k === 'ingredient' ? 5 : 10));
        await expect(r.locator('.stepper span')).toHaveText(String(s.qty));
        await r.getByRole('button', { name: 'Comprar' }).click();
        await expect(page.locator('.pastel-de-feira .tab .warn[role="status"]')).toHaveCount(0);
        break;
      }
    }
  }
}
