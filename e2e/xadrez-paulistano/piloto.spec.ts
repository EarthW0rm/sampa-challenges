import { readFileSync } from 'node:fs';
import { HubPage } from '../support/hub';
import { runPilot } from '../support/pilot';
import { MAX_FRAMES, recompute, xadrezStrategy } from './support/pilot';
import type { MenuOptions, XadrezPage } from './support/page';
import { expect, test } from './support/test';

interface Variant {
  name: string;
  menu: MenuOptions;
  seed: number;
}

const VARIANTS: Variant[] = [
  { name: 'contra o nível 10', menu: { mode: 'pvc', level: 10, color: 'Brancas', names: ['Piloto'] }, seed: 101 },
  { name: 'contra o nível 50', menu: { mode: 'pvc', level: 50, color: 'Pretas', names: ['Piloto'] }, seed: 202 },
  { name: 'contra o nível 90', menu: { mode: 'pvc', level: 90, color: 'Brancas', names: ['Piloto'] }, seed: 303 },
  { name: '2 jogadores', menu: { mode: 'pvp', names: ['Piloto A', 'Piloto B'] }, seed: 404 },
];

const DETAIL: Record<string, string> = {
  stalemate: 'Afogamento: quem tem a vez não tem lance legal e não está em xeque.',
  fifty: '50 lances de cada lado sem captura nem movimento de peão.',
  repetition: 'A mesma posição se repetiu três vezes.',
  material: 'Material insuficiente: ninguém consegue dar xeque-mate.',
};

/** Uma partida inteira do piloto; confere RN-22 (resultado e lista exibidos = recalculados, card sem recorde). */
async function playMatch(game: XadrezPage, v: Variant, testInfo: Parameters<Parameters<typeof test>[2]>[1], match = 1): Promise<string> {
  await game.start(v.menu, { seed: v.seed });
  await game.evidence(`Início da partida (${v.name})`);
  const run = await runPilot(game, xadrezStrategy(v.seed), { seed: v.seed, variant: v.name, maxFrames: MAX_FRAMES, decideEvery: 6, match, testInfo });
  await game.frames(30);
  await game.evidence(`Fim da partida (${v.name})`);
  expect(run.status).toBe('fim');

  const s = await game.state();
  const r = recompute(s.startFen, s.ucis);
  expect(s.outcome, 'resultado exibido = recalculado').toEqual(r.outcome);
  expect(s.moves, 'notação exibida = recalculada').toEqual(r.sans);
  const pairs: string[] = [];
  for (let i = 0; i < r.sans.length; i += 2) pairs.push(`${i / 2 + 1}. ${r.sans[i]}${r.sans[i + 1] ? ` ${r.sans[i + 1]}` : ''}`);
  expect(await game.listItems()).toEqual(pairs);

  const over = game.page.getByRole('dialog', { name: 'Fim de partida' });
  const o = r.outcome!;
  if (o.kind === 'checkmate') {
    await expect(over.getByRole('heading')).toHaveText(`${s.names[o.winner]} venceu!`);
    await expect(over.locator('p')).toHaveText(`Xeque-mate das ${o.winner ? 'pretas' : 'brancas'}.`);
  } else {
    await expect(over.getByRole('heading')).toHaveText('Empate');
    await expect(over.locator('p')).toHaveText(DETAIL[o.kind]);
  }

  const hub = new HubPage(game.page, game.ev);
  await hub.back();
  expect((await hub.cards()).find((c) => c.id === 'xadrez-paulistano')?.record, 'sem recorde no card').toBeNull();
  return run.file;
}

test.describe('Xadrez Paulistano — piloto', () => {
  for (const v of VARIANTS) {
    test(`XP-RN-24 XP-RN-25 XP-RN-28 partida inteira ${v.name}`, async ({ game }, testInfo) => {
      test.setTimeout(15 * 60_000);
      await playMatch(game, v, testInfo);
    });
  }

  test('XP-RN-26 XP-RN-28 mesma semente, mesma partida (dois arquivos de diagnóstico iguais)', async ({ game, page }, testInfo) => {
    test.setTimeout(15 * 60_000);
    const v = VARIANTS[0];
    const a = await playMatch(game, v, testInfo, 1);
    // carga nova da página (mesma semente): a segunda partida começa do zero
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    const b = await playMatch(game, v, testInfo, 2);
    expect(JSON.parse(readFileSync(b, 'utf8'))).toEqual(JSON.parse(readFileSync(a, 'utf8')));
  });
});
