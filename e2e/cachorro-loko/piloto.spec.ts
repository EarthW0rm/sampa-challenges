import { readFileSync } from 'node:fs';
import { FPS } from '../support/game-page';
import { HubPage } from '../support/hub';
import { runPilot } from '../support/pilot';
import { readStorage } from '../support/storage';
import { RECORD_KEY, type CachorroLokoPage } from './support/page';
import { cachorroStrategy, DECIDE_EVERY, MAX_FRAMES, recalc } from './support/pilot';
import { expect, test } from './support/test';
import type { Page, TestInfo } from '@playwright/test';

/** Joga uma partida inteira pela tela e confere RN-22 no fim. Devolve o caminho do `partida-<n>.json`. */
async function playMatch(game: CachorroLokoPage, page: Page, testInfo: TestInfo, seed: number, match: number, record: number): Promise<{ file: string; score: number }> {
  await game.play({ seed, note: `(piloto, semente ${seed})` });
  const run = await runPilot(game, cachorroStrategy(), { seed, variant: `semente ${seed}`, maxFrames: MAX_FRAMES, decideEvery: DECIDE_EVERY, match, testInfo });
  expect(run.status).toBe('fim');
  const s = await game.state();
  const events = await game.events();
  const r = recalc(events);
  // RN-22: placar exibido = o do jogo = o recalculado a partir dos eventos; vidas zeradas pelas contas
  expect(r.score, 'placar recalculado').toBe(s.score);
  expect(r.delivered).toBe(s.delivered);
  expect(r.lives, 'vidas recalculadas').toBe(0);
  expect(s.lives).toBe(0);
  // RN-24: passou pelo menos do nível 3
  expect(run.result.nivelMaximo as number, 'nível máximo').toBeGreaterThanOrEqual(3);
  await game.waitGameOver();
  const over = page.getByRole('dialog', { name: 'Fim de jogo' });
  await expect(over.locator('.final-score')).toHaveText(`${s.score} entregas`);
  const best = Math.max(record, s.score);
  expect(await readStorage(page, RECORD_KEY)).toBe(best > 0 ? String(best) : null);
  await expect(over.locator('.final-record')).toHaveText(s.score > record ? 'Novo recorde!' : `Recorde: ${best}`);
  return { file: run.file, score: s.score };
}

/** Mesmo arquivo de diagnóstico sem os campos que não dependem da partida. */
const comparable = (file: string) => {
  const j = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  return { ...j, erros: undefined };
};

test.describe('Cachorro Loko — piloto', () => {
  test.setTimeout(10 * 60_000);

  for (const seed of [11, 23]) {
    test(`CL-RN-26 CL-RN-27 piloto, semente ${seed}: joga até perder as 3 vidas passando do nível 3; placar e recorde conferem no fim e no card do hub`, async ({ game, page }, testInfo) => {
      const { score } = await playMatch(game, page, testInfo, seed, 1, 0);
      await page.getByRole('dialog', { name: 'Fim de jogo' }).getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByText(`Recorde: ${score}`)).toBeVisible();
      const hub = new HubPage(page, game.ev);
      await hub.back();
      await expect(hub.card('cachorro-loko').locator('.hub-record')).toHaveText(`Recorde ${score}`);
    });
  }

  test('CL-RN-07 CL-RN-15 piloto, semente 37 duas vezes: mesma semente e mesmos gestos dão a mesma partida', async ({ game, page }, testInfo) => {
    const a = await playMatch(game, page, testInfo, 37, 1, 0);
    // segunda partida num documento novo com a mesma semente (o recorde da primeira fica guardado).
    // Não usa about:blank: o init script do relógio lê o sessionStorage e lá o acesso é negado (pageerror).
    await page.goto('./?partida=2#/');
    const b = await playMatch(game, page, testInfo, 37, 2, a.score);
    expect(b.score).toBe(a.score);
    expect(comparable(b.file)).toEqual(comparable(a.file));
    await game.evidence(`Duas partidas iguais: ${a.score} entregas em ${Math.round((JSON.parse(readFileSync(a.file, 'utf8')) as { quadros: number }).quadros / FPS)} s`);
  });
});
