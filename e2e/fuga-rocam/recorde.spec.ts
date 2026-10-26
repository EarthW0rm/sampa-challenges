import { PIZZA_POINTS } from '../../src/games/fuga-rocam/game/constants';
import { HubPage } from '../support/hub';
import { expectStored } from '../support/storage';
import { recordKey, SOUND_KEY } from './support/page';
import type { FugaPage } from './support/page';
import { expect, test } from './support/test';

/** Pega uma pizza posta no caminho (pré-condição rara: pontos sem depender de entregas) e perde a última vida. */
async function pizzaAndCaught(game: FugaPage): Promise<void> {
  await game.turn('ArrowLeft');
  await game.frames(4);
  const p0 = (await game.state()).player;
  await game.hook((h, t) => {
    h.prepare.item('pizza', t[0] - 3, t[1]);
    h.prepare.lives(1);
  }, [p0.tx, p0.ty]);
  await game.advanceUntil((h) => h.state().score > 0, 3, undefined, 2);
  const p = (await game.state()).player;
  await game.hook((h, t) => h.prepare.cop('car', t[0], t[1], 2), [p.tx, p.ty]);
  await game.advanceUntil((h) => h.state().phase === 'over', 3, undefined, 2);
}

test.describe('Fuga da Rocam — fim de jogo, recorde e som', () => {
  test('FR-RN-28 FR-RN-29 fim de jogo, recorde por mapa (novo recorde pela pizza), Jogar de novo e card do hub', async ({ game, page }) => {
    await game.start('centro', { storage: { [recordKey('centro')]: '100', [recordKey('marginal')]: '90' } });
    await expect(page.locator('.fuga-rocam .hud-rec')).toHaveText('REC 100');
    await pizzaAndCaught(game);
    const s = await game.state();
    expect(s.score).toBe(PIZZA_POINTS);
    await expect(page.locator('.fuga-rocam .hud-rec')).toHaveText('NOVO RECORDE');
    // a caixa de fim aparece OVER_DELAY depois (timer real)
    const over = page.getByRole('dialog', { name: 'Fim de jogo' });
    await expect(over).toBeVisible();
    await expect(over).toContainText('PEGO PELA ROCAM');
    await expect(over.locator('.final-score')).toHaveText(`${PIZZA_POINTS} pontos`);
    await expect(over.locator('.final-record')).toHaveText('0 entregas · Novo recorde!');
    await expectStored(page, recordKey('centro'), String(PIZZA_POINTS));
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeDisabled();
    await game.pressKey('KeyP');
    expect((await game.state()).phase, 'sem pausa no fim').toBe('over');

    await over.getByRole('button', { name: 'Jogar de novo' }).click();
    const r = await game.state();
    expect(r).toMatchObject({ phase: 'ready', score: 0, record: PIZZA_POINTS, map: 'centro' });
    await page.getByRole('button', { name: '← Mapas' }).click();
    await expect(game.mapCard('centro').locator('.map-rec')).toHaveText(`Recorde: ${PIZZA_POINTS}`);
    await expect(game.mapCard('marginal').locator('.map-rec')).toHaveText('Recorde: 90');
    const hub = new HubPage(page, game.ev);
    await hub.back();
    await expect(hub.card('fuga-rocam').locator('.hub-record')).toHaveText(`Recorde ${PIZZA_POINTS}`);
  });

  test('FR-RN-29 primeira partida do mapa sem novo recorde; sair no meio grava; valor inválido conta como zero', async ({ game, page }) => {
    await game.start('paulista', { rawStorage: { [recordKey('paulista')]: 'abc', [recordKey('centro')]: '-5' } });
    expect((await game.state()).record).toBe(0);
    await pizzaAndCaught(game);
    const over = page.getByRole('dialog', { name: 'Fim de jogo' });
    await expect(over.locator('.final-record')).toHaveText(`0 entregas · Recorde: ${PIZZA_POINTS}`);
    await over.getByRole('button', { name: 'Jogar de novo' }).click();
    // sair no meio da partida também grava
    await game.turn('ArrowLeft');
    await game.frames(4);
    // pré-condição rara: duas pizzas no caminho
    await game.hook((h) => {
      h.prepare.item('pizza', 14, 7);
      h.prepare.item('pizza', 12, 7);
    });
    await game.advanceUntil((h) => h.state().score >= 300, 4, undefined, 2);
    await page.getByRole('button', { name: '← Mapas' }).click();
    await expectStored(page, recordKey('paulista'), String(2 * PIZZA_POINTS));
    await expect(game.mapCard('centro').locator('.map-rec')).toHaveText('Sem recorde ainda');
  });

  test('FR-RN-30 Som: o botão liga e desliga e a escolha fica gravada', async ({ game, page }) => {
    await game.start('centro');
    const btn = page.getByRole('button', { name: /^Som:/ });
    await expect(btn).toHaveText('Som: não');
    await btn.click();
    await expect(btn).toHaveText('Som: sim');
    await expectStored(page, SOUND_KEY, 'on');
    await page.reload();
    await game.chooseMap('centro');
    await expect(page.getByRole('button', { name: /^Som:/ })).toHaveText('Som: sim');
    await page.getByRole('button', { name: /^Som:/ }).click();
    await expectStored(page, SOUND_KEY, 'off');
  });
});
