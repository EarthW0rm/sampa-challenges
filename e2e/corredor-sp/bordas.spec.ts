import { START_LIVES } from '../../src/games/corredor-sp/game/constants';
import { HubPage } from '../support/hub';
import { readStorage } from '../support/storage';
import { CHOICE_KEY, COUNTDOWN_FRAMES, recordKey } from './support/page';
import { expect, test } from './support/test';

test.describe('Corredor SP — bordas (spec RN-47)', () => {
  test('CS-RN-28 perda de foco pausa; quadro gigante (aba voltando) avança no máximo 0,05 s', async ({ game }) => {
    await game.race();
    await game.drive({ frames: 60 });
    const a = await game.state();
    await game.jump(60_000);
    await game.frames(1);
    const b = await game.state();
    expect(b.time - a.time, 'dt limitado').toBeLessThanOrEqual(0.05 + 1e-9);
    expect(b.phase).toBe('racing');
    await game.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(game.dialog('Pausa')).toBeVisible();
    expect((await game.state()).paused).toBe(true);
  });

  test('CS-RN-02 CS-RN-27 armazenamento bloqueado: escolhe, corre, termina o turno sem erro', async ({ game, page }) => {
    await game.race({ track: 'radial-leste', modelId: 'foguetinho' }, { blockStorage: true, calm: true });
    await game.drive({ frames: 120, x: 0 });
    await game.prepare((h) => {
      h.prepare.lives(1); // pré-condição: última vida
      h.prepare.spawn('carro', { x: h.state().player.x }, 1500, 0);
    });
    await game.drive({ frames: 300, x: 0, until: (st) => st.player.crashT > 0 });
    await game.frames(130);
    const dialog = game.dialog('Fim de turno');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Novo recorde nesta pista!');
    await page.locator('.corredor-sp .race-bar button').nth(1).click();
    await dialog.getByRole('button', { name: 'Trocar moto ou pista' }).click();
    await expect(game.trackButton('radial-leste')).not.toContainText('Recorde');
  });

  test('CS-RN-02 CS-RN-27 recorde e escolha corrompidos valem o padrão sem quebrar o jogo', async ({ game, page }) => {
    await game.open({
      rawStorage: {
        [recordKey('23-de-maio')]: 'abc',
        [recordKey('radial-leste')]: '-5',
        [recordKey('nacoes-unidas')]: '12.7',
        [CHOICE_KEY]: '{quebrado',
      },
    });
    await expect(game.trackButton('23-de-maio')).not.toContainText('Recorde');
    await expect(game.trackButton('radial-leste')).not.toContainText('Recorde');
    await expect(game.trackButton('nacoes-unidas')).toContainText('Recorde 12');
    await expect(game.modelButton('entregadora')).toHaveAttribute('aria-pressed', 'true');
    // JSON válido com campos desconhecidos (pista, cachorro, cor)
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ track: 'marginal', breed: 'lobo', category: '150', modelId: 'entregadora', colorId: 'roxo' })), CHOICE_KEY);
    await page.reload();
    await expect(game.setupTitle).toBeVisible();
    await expect(game.trackButton('23-de-maio')).toHaveAttribute('aria-pressed', 'true');
    await expect(game.breedButton('caramelo')).toHaveAttribute('aria-pressed', 'true');
    await expect(game.colorButton('vermelho')).toHaveAttribute('aria-pressed', 'true');
    await game.start();
    await game.frames(COUNTDOWN_FRAMES);
    expect((await game.state()).track).toBe('23-de-maio');
    const hub = new HubPage(page, game.ev);
    await hub.back();
    expect((await hub.cards()).find((c) => c.id === 'corredor-sp')!.record, 'hub com o maior válido').toContain('12');
    expect(await readStorage(page, recordKey('23-de-maio'))).toBe('abc');
  });

  test('CS-RN-30 StrictMode: um laço e um listener; sair pelo hub no meio do turno e voltar', async ({ game, page }) => {
    await game.race();
    expect(await game.rafPending(), 'um laço só').toBe(1);
    await game.pressKey('p', 0);
    expect((await game.state()).paused, 'P alterna uma vez (listener único)').toBe(true);
    await game.pressKey('p', 0);
    await game.drive({ frames: 120 });
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
    await game.frames(5);
    expect(await game.rafPending(), 'laço desligado ao sair').toBe(0);
    expect(await game.hasHook()).toBe(false);
    const hub = new HubPage(page, game.ev);
    await hub.openGame('corredor-sp');
    await expect(game.setupTitle).toBeVisible();
    await game.start();
    await game.frames(COUNTDOWN_FRAMES);
    const s = await game.state();
    expect(s.time, 'turno novo').toBeLessThan(0.1);
    expect(s.player.lives).toBe(START_LIVES);
    expect(await game.rafPending()).toBe(1);
    await page.getByRole('button', { name: '← Trocar moto ou pista' }).click();
    await game.frames(2);
    expect(await game.rafPending(), 'sem laço na tela de escolha').toBe(0);
  });
});
