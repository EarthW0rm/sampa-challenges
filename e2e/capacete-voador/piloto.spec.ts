import { readFileSync } from 'node:fs';
import type { Difficulty, GameMode } from '../../src/games/capacete-voador/game/types';
import { HubPage } from '../support/hub';
import { runPilot } from '../support/pilot';
import { capaceteStrategy, recalc } from './support/pilot';
import { expect, test } from './support/test';

/** 15 min de jogo por partida. */
const MAX_FRAMES = 15 * 60 * 60;

const VARIANTS: { name: string; mode: GameMode; difficulty?: Difficulty; seed: number }[] = [
  { name: '2 jogadores', mode: 'pvp', seed: 11 },
  { name: 'contra o computador fácil', mode: 'pvc', difficulty: 'facil', seed: 12 },
  { name: 'contra o computador médio', mode: 'pvc', difficulty: 'medio', seed: 13 },
  { name: 'contra o computador difícil', mode: 'pvc', difficulty: 'dificil', seed: 14 },
  { name: 'treino', mode: 'practice', seed: 15 },
];

test.describe('Capacete Voador — piloto', () => {
  for (const v of VARIANTS) {
    test(`CV-RN-22 CV-RN-24 partida completa: ${v.name}`, async ({ game, page }, testInfo) => {
      test.setTimeout(240_000);
      await game.play({ mode: v.mode, difficulty: v.difficulty, names: ['Piloto', v.mode === 'pvp' ? 'Piloto 2' : undefined] }, { seed: v.seed });
      const run = await runPilot(game, capaceteStrategy(), { seed: v.seed, variant: v.name, maxFrames: MAX_FRAMES, testInfo, decideEvery: 30 });
      expect(run.status).toBe('fim');
      const s = await game.state();
      const r = recalc(s);
      if (v.mode === 'practice') {
        expect(s.practiceHits, 'acertos do treino = recalculado').toBe(r.practiceHits);
        await expect(page.locator('.capacete-voador .scoreboard span').first()).toHaveText(`Tiros ${s.practiceShots} · Acertos ${r.practiceHits}`);
      } else {
        expect(s.scores, 'placar do jogo = recalculado pelos tiros').toEqual(r.scores);
        const dialog = page.getByRole('dialog', { name: 'Fim de jogo' });
        await expect(dialog.locator('p')).toHaveText(`${r.scores[0]} × ${r.scores[1]}`);
        const champ = r.scores[0] > r.scores[1] ? 0 : 1;
        await expect(dialog.locator('h2')).toHaveText(`${s.names[champ]} venceu!`);
        expect(Math.max(...r.scores)).toBe(s.pointsToWin);
      }
      await game.evidence(`Fim da partida (${v.name})`);
      // o jogo não tem recorde: o card do hub continua sem recorde
      const hub = new HubPage(page, game.ev);
      await hub.back();
      expect((await hub.cards()).find((c) => c.id === 'capacete-voador')!.record).toBeNull();
    });
  }

  test('CV-RN-22 mesma semente, mesma partida (contra o computador médio, 2 vezes)', async ({ game, page }, testInfo) => {
    test.setTimeout(240_000);
    const files: string[] = [];
    for (let n = 1; n <= 2; n++) {
      if (n === 1) await game.open({ seed: 21 });
      else {
        // recarregar repete o init script com a mesma semente
        await page.reload();
        await expect(game.startButton).toBeVisible();
      }
      await game.menu({ mode: 'pvc', difficulty: 'medio' });
      await game.start();
      const run = await runPilot(game, capaceteStrategy(), { seed: 21, variant: 'médio (repetição)', maxFrames: MAX_FRAMES, testInfo, decideEvery: 30, match: n });
      files.push(run.file);
    }
    const [a, b] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>);
    expect(b.comandos).toEqual(a.comandos);
    expect(b.resultado).toEqual(a.resultado);
    expect(b.quadros).toEqual(a.quadros);
  });
});
