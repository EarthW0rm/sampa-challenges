import { DT_MAX, PLAYER_SPEED } from '../../src/games/fuga-rocam/game/constants';
import { HubPage } from '../support/hub';
import { expectStored } from '../support/storage';
import { recordKey, SOUND_KEY } from './support/page';
import { expect, test } from './support/test';

test.describe('Fuga da Rocam — bordas', () => {
  test('determinismo: mesma semente, mesmo snapshot depois de 600 quadros (semente do motor segue o teste)', async ({ game, page }) => {
    const run = async () => {
      await game.chooseMap('centro');
      await game.turn('ArrowLeft');
      await game.frames(600);
      // o dt do laço sai de performance.now() − last, com a base real da carga: só os últimos bits do float mudam
      return game.hook((h) => JSON.stringify(h.state(), (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));
    };
    await game.open({ seed: 77 });
    const a = await run();
    // segunda carga da página: mesma semente, relógio virtual recomeça (Date.now da carga é outro)
    await page.reload();
    await expect(page.getByRole('heading', { name: 'FUGA DA ROCAM' })).toBeVisible();
    const b = await run();
    expect(b).toBe(a);
  });

  test('FR-RN-31 quadro gigante não teleporta; um laço só (StrictMode); sair pelo hub no meio e voltar', async ({ game, page }) => {
    await game.start('centro');
    expect(await game.rafPending(), 'um único laço de quadros').toBe(1);
    await game.turn('ArrowLeft');
    const a = await game.state();
    await game.jump(5000);
    await game.frames(1);
    const b = await game.state();
    expect(a.player.x - b.player.x, 'passo limitado a DT_MAX').toBeCloseTo(PLAYER_SPEED * DT_MAX, 6);
    expect(b.time - a.time).toBeCloseTo(DT_MAX, 9);

    // sai pela barra do hub no meio da partida e volta
    const hub = new HubPage(page, game.ev);
    await hub.back();
    expect(await game.hasHook(), 'motor descartado').toBe(false);
    expect(await game.rafPending(), 'nenhum laço vivo na home').toBe(0);
    await hub.openGame('fuga-rocam');
    await game.chooseMap('centro');
    const c = await game.state();
    expect(c).toMatchObject({ phase: 'ready', score: 0, lives: 3 });
    expect(await game.rafPending()).toBe(1);
  });

  test('FR-RN-31 armazenamento bloqueado: joga sem recorde nem preferência de som', async ({ game, page }) => {
    await game.start('marginal', { blockStorage: true });
    expect((await game.state()).record).toBe(0);
    await page.getByRole('button', { name: /^Som:/ }).click();
    await game.turn('ArrowLeft');
    await game.frames(60);
    expect((await game.state()).phase).toBe('play');
    await page.getByRole('button', { name: '← Mapas' }).click();
    await expect(game.mapCard('marginal').locator('.map-rec')).toHaveText('Sem recorde ainda');
  });

  test('FR-RN-08 FR-RN-29 arrastar com o mouse não muda a direção; recorde e som corrompidos não quebram', async ({ game, page }) => {
    await game.start('centro', { rawStorage: { [recordKey('centro')]: '{x', [SOUND_KEY]: '???' } });
    expect((await game.state()).record).toBe(0);
    await expect(page.getByRole('button', { name: /^Som:/ })).toHaveText('Som: sim');
    await game.dragFromTo({ x: 300, y: 200 }, { x: 300, y: 320 }, 8);
    const s = await game.state();
    expect(s.want).toBeNull();
    expect(s.phase).toBe('ready');
    await expectStored(page, recordKey('centro'), '{x');
  });
});
