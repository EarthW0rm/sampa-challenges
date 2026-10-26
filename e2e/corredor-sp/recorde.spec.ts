import { CRASH_TIME, METERS_PER_POINT, START_LIVES } from '../../src/games/corredor-sp/game/constants';
import { FPS } from '../support/game-page';
import { HubPage } from '../support/hub';
import { readStorage } from '../support/storage';
import type { CorredorPage } from './support/page';
import { recordKey } from './support/page';
import { expect, test } from './support/test';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Roda um pouco, pega um pacote e bate com a última vida; devolve o estado no fim do turno. */
async function finish(game: CorredorPage) {
  await game.drive({ frames: 300, x: 0 });
  await game.prepare((h) => h.prepare.thing('pacote', h.state().player.x, 3000)); // pré-condição: um pacote na linha
  await game.drive({ frames: 300, x: 0, until: (st) => st.packages === 1 });
  await game.prepare((h) => {
    h.prepare.lives(1); // pré-condição: última vida (encurta o turno)
    h.prepare.spawn('carro', { x: h.state().player.x }, 2000, 0);
  });
  const s = await game.drive({ frames: 300, x: 0, until: (st) => st.player.crashT > 0 });
  expect(s.player.lives).toBe(0);
  expect(s.banner).toBe('FIM DE TURNO');
  expect(s.phase, 'o turno acaba quando a moto termina de cair').toBe('racing');
  await game.frames(Math.round(CRASH_TIME * FPS) + 2);
  const end = await game.state();
  expect(end.phase).toBe('over');
  return end;
}

test.describe('Corredor SP — fim de turno e recorde', () => {
  test('CS-RN-26 CS-RN-27 fim de turno mostra a conta, grava recorde maior e o card da pista e do hub mostram', async ({ game, page }) => {
    // pré-condição: pista vazia (o teste controla pacote e batida)
    await game.race({ track: 'nacoes-unidas' }, { calm: true });
    const end = await finish(game);
    const t = Math.floor(end.time);
    const m = Math.floor(end.meters);
    expect(end.points).toBe((t + Math.floor(end.meters / METERS_PER_POINT)) * (1 + end.packages));
    await game.frames(30);
    expect((await game.state()).player.kmh, 'a moto desliza até parar').toBeLessThan(end.player.kmh + 0.001);
    const dialog = game.dialog('Fim de turno');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('FIM DE TURNO');
    await expect(dialog).toContainText(`${end.points} pontos`);
    await expect(dialog).toContainText(`(${mmss(t)} na pista + ${m} m rodados) × (1 + ${end.packages} pacotes) · ${end.overtakes} ultrapassagens`);
    await expect(dialog).toContainText('Novo recorde nesta pista!');
    expect(await readStorage(page, recordKey('nacoes-unidas'))).toBe(String(end.points));
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeDisabled();
    await game.pressKey('p', 0);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect((await game.state()).paused, 'no fim de turno não há pausa').toBe(false);

    await dialog.getByRole('button', { name: 'Correr de novo' }).click();
    await game.frames(1);
    const again = await game.state();
    expect(again.phase).toBe('countdown');
    expect(again.player.lives).toBe(START_LIVES);
    expect(again.time).toBe(0);
    expect(again.packages).toBe(0);
    expect(again.record, 'o turno novo já conhece o recorde').toBe(end.points);

    await page.getByRole('button', { name: '← Trocar moto ou pista' }).click();
    await expect(game.trackButton('nacoes-unidas')).toContainText(`Recorde ${end.points}`);
    await expect(game.trackButton('23-de-maio')).not.toContainText('Recorde');
    const hub = new HubPage(page, game.ev);
    await hub.back();
    const card = (await hub.cards()).find((c) => c.id === 'corredor-sp')!;
    expect(card.record).toContain(String(end.points));
  });

  test('CS-RN-27 recorde não batido não muda; o hub mostra o maior entre as pistas', async ({ game, page }) => {
    const big = 999999;
    // pré-condição: recordes já guardados em duas pistas
    await game.race({ track: '23-de-maio' }, { calm: true, storage: { [recordKey('23-de-maio')]: '5', [recordKey('radial-leste')]: String(big) } });
    const end = await finish(game);
    const dialog = game.dialog('Fim de turno');
    expect(end.points).toBeGreaterThan(5);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Novo recorde nesta pista!');
    await dialog.getByRole('button', { name: 'Trocar moto ou pista' }).click();
    await game.choose({ track: 'radial-leste' });
    await game.start();
    await game.prepare((h) => h.prepare.calm(true)); // pré-condição: pista vazia
    await game.frames(185);
    const end2 = await finish(game);
    expect(end2.points).toBeLessThan(big);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Recorde da pista: ${big}`);
    expect(await readStorage(page, recordKey('radial-leste'))).toBe(String(big));
    const hub = new HubPage(page, game.ev);
    await hub.back();
    expect((await hub.cards()).find((c) => c.id === 'corredor-sp')!.record).toContain(String(big));
  });
});
