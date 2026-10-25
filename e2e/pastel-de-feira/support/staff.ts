/** Equipe pelo Preparo: contratar pela aba Equipe e escolher a posição, como o jogador faz. */
import type { GamePage } from './game';

/** Contrata o primeiro candidato do tipo e escolhe a posição (rótulo do seletor, ex.: "Montagem 1"). */
export async function hire(game: GamePage, kind: 'Fritador' | 'Geral', position: string): Promise<void> {
  const page = game.page;
  await page.getByRole('tab', { name: 'Equipe' }).click();
  const cand = page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong', { hasText: `· ${kind}` }) }).filter({ has: page.getByRole('button', { name: /^Contratar/ }) }).first();
  await cand.getByRole('button', { name: /^Contratar/ }).click();
  const staff = page.locator('.pastel-de-feira li.item.staff').last();
  await staff.getByRole('combobox').selectOption({ label: position });
}
