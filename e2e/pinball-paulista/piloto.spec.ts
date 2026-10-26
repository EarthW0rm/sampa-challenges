import { readFileSync } from 'node:fs';
import { BALLS_PER_GAME } from '../../src/games/pinball-paulista/game/constants';
import { runPilot } from '../support/pilot';
import { expectStored } from '../support/storage';
import { DECIDE_EVERY, MAX_FRAMES, pinballStrategy } from './support/pilot';
import { tallyTotal } from './support/rules';
import type { PinballPage } from './support/page';
import { expect, test } from './support/test';

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Confere o fim de uma partida (spec RN-22): placar exibido = recalculado, bônus, recorde salvo e no card do hub. */
async function checkEnd(game: PinballPage, previousRecord: number): Promise<number> {
  const page = game.page;
  const s = await game.state();
  expect(s.phase).toBe('over');
  expect(s.ball).toBe(BALLS_PER_GAME);
  expect(tallyTotal(s.tally), 'soma dos eventos = placar').toBe(s.score);
  expect(s.bonusLog.length).toBeGreaterThanOrEqual(BALLS_PER_GAME);
  for (const b of s.bonusLog) expect(b.total).toBe(b.base * b.mult);
  expect(s.bonusLog.reduce((a, b) => a + b.total, 0)).toBe(s.tally.bonus?.pts ?? 0);
  const over = page.getByRole('dialog', { name: 'Fim de jogo' });
  await expect(over).toBeVisible();
  await expect(over.locator('.final-score')).toHaveText(`${fmt(s.score)} pontos`);
  expect(await game.shownScore()).toBe(s.score);
  const best = Math.max(previousRecord, s.score);
  await expect(over.locator('.final-record')).toHaveText(s.score > previousRecord ? 'Novo recorde!' : `Recorde: ${fmt(previousRecord)}`);
  await expectStored(page, 'pinball-paulista:recorde', best > 0 ? String(best) : null);
  await game.evidence(`Fim de jogo: ${s.score} pontos`);
  // card do hub
  await page.getByRole('link', { name: '← Sampa Challenges' }).click();
  const card = page.locator('.hub-card').filter({ has: page.locator('a[href="#/jogos/pinball-paulista"]') });
  await expect(card.locator('.hub-record')).toHaveText(`Recorde ${best}`);
  await game.evidence('Recorde no card do hub');
  return s.score;
}

test.describe('Pinball Paulista — piloto', () => {
  test.setTimeout(240_000);

  for (const seed of [1, 2, 3]) {
    test(`PP-RN-24 PP-RN-22 piloto joga as 3 bolas até o fim de jogo (semente ${seed})`, async ({ game }, testInfo) => {
      await game.open({ seed, storage: { 'pinball-paulista:recorde': '500' } });
      await game.evidence(`Partida do piloto, semente ${seed}`);
      const run = await runPilot(game, pinballStrategy(), { seed, variant: '3 bolas', maxFrames: MAX_FRAMES, decideEvery: DECIDE_EVERY, testInfo });
      expect(run.status).toBe('fim');
      expect(run.result.placar).toBe(run.result.recalculado);
      await checkEnd(game, 500);
    });
  }

  test('PP-RN-24 mesma semente, mesma partida (física e prêmios determinísticos)', async ({ game, page }, testInfo) => {
    const files: string[] = [];
    for (const match of [1, 2]) {
      if (match === 2) {
        // recomeça do zero na mesma aba: storage limpo como no 1º boot
        await page.evaluate(() => {
          localStorage.clear();
          localStorage.setItem('pinball-paulista:som', 'off');
        });
        // sai da página: o boot seguinte recarrega e ressemeia o Math.random (só trocar o hash não recarrega)
        await page.goto('about:blank');
      }
      await game.open({ seed: 1 });
      const run = await runPilot(game, pinballStrategy(), { seed: 1, variant: 'repetição', maxFrames: MAX_FRAMES, decideEvery: DECIDE_EVERY, match, testInfo });
      expect(run.status).toBe('fim');
      files.push(run.file);
    }
    const [a, b] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>);
    expect(b).toEqual(a);
  });
});
