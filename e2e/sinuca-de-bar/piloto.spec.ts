import { readFileSync } from 'node:fs';
import { HubPage } from '../support/hub';
import { runPilot } from '../support/pilot';
import type { MenuOptions, SinucaPage } from './support/page';
import { MAX_FRAMES, sinucaStrategy } from './support/pilot';
import { expect, test } from './support/test';

type Variant = { name: string; seed: number; menu: MenuOptions };

const VARIANTS: Variant[] = [
  { name: 'lisas-contra-pato', seed: 3, menu: { mode: 'pvc', rules: 'lisas', level: 1, names: ['Piloto'], breaker: 'p1' } },
  { name: 'parimpar-contra-pato', seed: 5, menu: { mode: 'pvc', rules: 'parimpar', level: 1, names: ['Piloto'], breaker: 'p2' } },
  { name: '2-jogadores-lisas', seed: 7, menu: { mode: 'pvp', rules: 'lisas', names: ['Ana', 'Bia'], breaker: 'p1' } },
];

/** Joga a partida inteira e confere RN-22: resultado exibido = recalculado, nenhum recorde, console limpo. */
async function play(game: SinucaPage, v: Variant, match: number, testInfo: Parameters<Parameters<typeof test>[2]>[1]) {
  const strategy = sinucaStrategy(v.seed);
  const run = await runPilot(game, strategy, { seed: v.seed, variant: v.name, maxFrames: MAX_FRAMES, decideEvery: 30, match, testInfo });
  expect(run.status).toBe('fim');
  expect(strategy.stats.divergencias, 'tacadas recalculadas pelas regras = jogo').toEqual([]);
  const s = await game.state();
  expect(s.winner).not.toBeNull();
  expect(strategy.stats.tacadas).toBe(s.shots);
  const winner = s.names[s.winner!];
  const dialog = game.page.getByRole('dialog', { name: 'Fim de partida' });
  await expect(dialog.getByRole('heading')).toHaveText(s.mode === 'pvc' && s.winner === 1 ? 'O computador venceu!' : `${winner} venceu!`);
  await expect(dialog.getByText(s.endReason!)).toBeVisible();
  await expect(dialog.getByText(`Placar: ${s.names[0]} ${s.wins[0]} × ${s.wins[1]} ${s.names[1]}`)).toBeVisible();
  expect(s.wins[s.winner!]).toBe(1);
  await game.evidence(`Fim da partida ${match} (${v.name}): ${winner} venceu em ${s.shots} tacadas`);
  return run;
}

test.describe('Sinuca de Bar — piloto (partidas inteiras)', () => {
  for (const v of VARIANTS) {
    test(`SB-RN-29 partida completa: ${v.name}`, async ({ game, page }, testInfo) => {
      test.setTimeout(240_000);
      await game.start(v.menu, { seed: v.seed });
      await play(game, v, 1, testInfo);
      // não há recorde: o card do hub continua sem recorde
      const hub = new HubPage(page, game.ev);
      await hub.back();
      expect((await hub.cards()).find((c) => c.id === 'sinuca-de-bar')?.record ?? null).toBeNull();
    });
  }

  test('SB-RN-33 mesma semente, mesma partida (partida-1.json = partida-2.json)', async ({ game, page }, testInfo) => {
    test.setTimeout(300_000);
    const v = VARIANTS[0];
    await game.start(v.menu, { seed: v.seed });
    const a = await play(game, v, 1, testInfo);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
    await game.menu();
    const b = await play(game, v, 2, testInfo);
    const strip = (f: string) => {
      const j = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
      return JSON.stringify({ ...j, erros: undefined });
    };
    expect(strip(b.file)).toBe(strip(a.file));
  });
});
