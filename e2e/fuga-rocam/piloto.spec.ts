import { readFileSync } from 'node:fs';
import { START_LIVES } from '../../src/games/fuga-rocam/game/constants';
import { MAPS } from '../../src/games/fuga-rocam/game/maps';
import type { MapId } from '../../src/games/fuga-rocam/game/types';
import { HubPage } from '../support/hub';
import { runPilot } from '../support/pilot';
import { expectStored } from '../support/storage';
import { recordKey, type FugaPage } from './support/page';
import { fugaStrategy } from './support/pilot';
import { expect, test } from './support/test';

/** 20 min de jogo por mapa (60 quadros/s). */
const MAX_FRAMES = 20 * 60 * 60;
const SEEDS: Record<MapId, number> = { centro: 101, paulista: 202, marginal: 303 };

async function play(game: FugaPage, map: MapId, match: number, testInfo: Parameters<typeof runPilot>[2]['testInfo'], seed = SEEDS[map]) {
  await game.chooseMap(map);
  await game.evidence(`Início da partida (${map}, semente ${seed})`);
  const strategy = fugaStrategy(map);
  const run = await runPilot(game, strategy, { seed, variant: map, maxFrames: MAX_FRAMES, match, testInfo });
  await game.evidence(`Fim da partida (${map}): ${run.result.pontos} pontos`);
  return run;
}

test.describe('Fuga da Rocam — piloto', () => {
  test('FR-RN-23 FR-RN-28 FR-RN-29 piloto joga cada mapa até acabar as vidas (≥ 3 estrelas); placar recalculado, recorde e card do hub', async ({ game, page }, testInfo) => {
    test.setTimeout(10 * 60_000);
    let best = 0;
    for (const [i, m] of MAPS.entries()) {
      await game.open({ seed: SEEDS[m.id] });
      const run = await play(game, m.id, i + 1, testInfo);
      const r = run.result as { pontos: number; recalculado: number; capturas: number; vidasGanhas: number; estrelasMax: number; naoExplicados: string[]; entregas: number; entregasContadas: number };
      expect(run.status).toBe('fim');
      expect(r.capturas, 'pego até acabar as vidas (3 + as vidas ganhas)').toBe(START_LIVES + r.vidasGanhas);
      expect(r.capturas).toBeGreaterThanOrEqual(3);
      expect(r.estrelasMax, 'chegou a 3 estrelas').toBeGreaterThanOrEqual(3);
      expect(r.naoExplicados).toEqual([]);
      expect(r.recalculado, 'placar = recalculado pelos eventos').toBe(r.pontos);
      expect(r.entregasContadas).toBe(r.entregas);
      // placar exibido na caixa de fim
      const over = page.getByRole('dialog', { name: 'Fim de jogo' });
      await expect(over.locator('.final-score')).toHaveText(`${r.pontos.toLocaleString('pt-BR')} pontos`);
      // recorde do mapa salvo (o storage começou limpo) e mostrado no card do hub (o maior dos mapas)
      await expectStored(page, recordKey(m.id), String(r.pontos));
      best = Math.max(best, r.pontos);
      const hub = new HubPage(page, game.ev);
      await hub.back();
      await expect(hub.card('fuga-rocam').locator('.hub-record')).toHaveText(`Recorde ${best}`);
    }
  });

  test('reprodutibilidade: mesma semente, mesma partida (partida-1.json = partida-2.json)', async ({ game, page }, testInfo) => {
    test.setTimeout(10 * 60_000);
    await game.open({ seed: SEEDS.centro });
    const a = await play(game, 'centro', 1, testInfo);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'FUGA DA ROCAM' })).toBeVisible();
    // a recarga preserva o storage (recorde da 1ª partida): apaga para as duas partirem iguais
    await page.evaluate((k) => localStorage.removeItem(k), recordKey('centro'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'FUGA DA ROCAM' })).toBeVisible();
    const b = await play(game, 'centro', 2, testInfo);
    const strip = (f: string) => {
      const j = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
      delete j.erros;
      return j;
    };
    expect(strip(b.file)).toEqual(strip(a.file));
  });
});
