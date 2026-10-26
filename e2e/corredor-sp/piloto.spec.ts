import { readFileSync } from 'node:fs';
import { TRACKS, type TrackId } from '../../src/games/corredor-sp/game/data';
import { HubPage } from '../support/hub';
import { runPilot } from '../support/pilot';
import { readStorage } from '../support/storage';
import { COUNTDOWN_FRAMES, recordKey, type CorredorPage } from './support/page';
import { corredorStrategy, MAX_FRAMES } from './support/pilot';
import { expect, test } from './support/test';

const SEED: Record<TrackId, number> = { '23-de-maio': 23, 'radial-leste': 31, 'nacoes-unidas': 47 };

/** Um turno inteiro pelo piloto, a partir da tela de escolha já aberta. */
async function playTurn(game: CorredorPage, track: TrackId, match: number, testInfo: Parameters<typeof runPilot>[2]['testInfo']) {
  await game.choose({ track });
  await game.start();
  await game.frames(COUNTDOWN_FRAMES);
  await game.evidence(`Largada do piloto em ${track}`);
  await game.page.keyboard.down('ArrowUp'); // ↑ segurado o turno inteiro
  const run = await runPilot(game, corredorStrategy(), { seed: SEED[track], variant: track, maxFrames: MAX_FRAMES, match, testInfo });
  await game.page.keyboard.up('ArrowUp');
  await game.evidence(`Fim do turno do piloto em ${track}`);
  return run;
}

/** RN-22: placar exibido = recalculado, recorde gravado e mostrado no card da pista e do hub. */
async function checkEnd(game: CorredorPage, track: TrackId, result: Record<string, unknown>) {
  const points = result.pontos as number;
  expect(points, 'pontos exibidos = fórmula do manual').toBe(result.recalculado);
  expect(result.nivel as number, 'passou do nível 2 (spec RN-24)').toBeGreaterThanOrEqual(2);
  const dialog = game.dialog('Fim de turno');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${points} pontos`);
  await expect(dialog).toContainText('Novo recorde nesta pista!');
  expect(await readStorage(game.page, recordKey(track))).toBe(String(points));
  await dialog.getByRole('button', { name: 'Trocar moto ou pista' }).click();
  await expect(game.trackButton(track)).toContainText(`Recorde ${points}`);
}

test.describe('Corredor SP — piloto (turnos inteiros)', () => {
  test.setTimeout(6 * 60_000);

  for (const t of TRACKS) {
    test(`CS-RN-25 CS-RN-26 CS-RN-27 piloto: um turno até o fim das vidas na ${t.name}`, async ({ game, page }, testInfo) => {
      await game.open({ seed: SEED[t.id] });
      const run = await playTurn(game, t.id, 1, testInfo);
      expect(run.status).toBe('fim');
      await checkEnd(game, t.id, run.result);
      const hub = new HubPage(page, game.ev);
      await hub.back();
      expect((await hub.cards()).find((c) => c.id === 'corredor-sp')!.record).toContain(String(run.result.pontos));

      if (t.id === '23-de-maio') {
        // reprodutibilidade: mesma semente, mesma escolha, mesmos gestos → mesma partida
        await page.evaluate((k) => localStorage.removeItem(k), recordKey(t.id));
        await page.goto('./#/jogos/corredor-sp');
        await page.reload();
        await expect(game.setupTitle).toBeVisible();
        const again = await playTurn(game, t.id, 2, testInfo);
        const strip = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
        expect(strip(again.file), 'partida-2.json = partida-1.json').toEqual(strip(run.file));
      }
    });
  }
});
