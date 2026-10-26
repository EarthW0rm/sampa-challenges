import { BOX_SIZE, GROUND_Y, START_LIVES } from '../../src/games/cachorro-loko/game/constants';
import { HubPage } from '../support/hub';
import { expectStored } from '../support/storage';
import { RECORD_KEY } from './support/page';
import { expect, test } from './support/test';

test.describe('Cachorro Loko — navegação', () => {
  test('CL-RN-01 CL-RN-28 título, início pelo Enter, ← Menu e volta ao hub', async ({ game, page }) => {
    await game.openTitle();
    await expect(page.getByText(/^Recorde:/), 'sem recorde salvo').toHaveCount(0);
    expect(await game.hasHook(), 'sem motor no título, sem gancho').toBe(false);

    await game.start('Enter');
    await game.frames(1);
    const s = await game.state();
    expect(s).toMatchObject({ phase: 'playing', score: 0, lives: START_LIVES, level: 1, dog: { x: 140, facing: 1 } });
    await expect(page.locator('.cachorro-loko .score')).toHaveText('ENTREGAS 000');
    await expect(page.locator('.cachorro-loko .level')).toHaveText('Nível 1');

    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByRole('heading', { name: 'CACHORRO LOKO' })).toBeVisible();
    expect(await game.hasHook(), 'motor desmontado').toBe(false);

    await game.start('click');
    expect((await game.state()).score).toBe(0);
    await page.getByRole('link', { name: '← Sampa Challenges' }).click();
    await expect(page.locator('.hub-home')).toBeVisible();
  });

  test('CL-RN-01 Espaço também começa; o gancho não existe sem a flag de teste', async ({ game, page }) => {
    await game.openTitle();
    await game.start('Space');
    expect((await game.state()).phase).toBe('playing');

    // página sem o relógio de teste (sem a flag): o jogo roda, mas não publica gancho
    const plain = await page.context().newPage();
    await plain.goto(`./${game.route}`);
    await plain.getByRole('button', { name: 'Jogar' }).click();
    await expect(plain.locator('.cachorro-loko canvas')).toBeVisible();
    expect(await plain.evaluate(() => 'pastel' in window || '__e2e' in window || '__e2eLast' in window)).toBe(false);
    await plain.close();
  });

  test('CL-RN-26 CL-RN-27 fim do turno: diálogo após o atraso, recorde salvo, exibido no título e no card do hub; Jogar de novo zera', async ({ game, page }) => {
    await game.play();
    // pré-condições: chapeiro parado e 1 vida (o turno acaba no primeiro pacote perdido)
    await game.chef(false);
    await game.setLives(1);
    await game.settle(await game.dropOnDog('normal'));
    await game.settle(await game.dropOnDog('normal'));
    await expect(page.locator('.cachorro-loko .record')).toHaveText('NOVO RECORDE!');
    const ev = await game.settle(await game.dropAt('normal', 10));
    expect(ev).toMatchObject({ ev: 'land', lives: 0, score: 2 });
    let s = await game.state();
    expect(s.phase).toBe('over');
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeDisabled();
    // P no fim do turno não pausa
    await game.pause('KeyP');
    expect((await game.state()).phase).toBe('over');
    await game.waitGameOver();
    const over = page.getByRole('dialog', { name: 'Fim de jogo' });
    await expect(over.locator('.final-score')).toHaveText('2 entregas');
    await expect(over.locator('.final-record')).toHaveText('Novo recorde!');
    await expectStored(page, RECORD_KEY, '2');

    await over.getByRole('button', { name: 'Jogar de novo' }).click();
    await expect(over).toBeHidden();
    s = await game.state();
    expect(s).toMatchObject({ phase: 'playing', score: 0, lives: START_LIVES, level: 1, record: 2, dog: { x: 140, facing: 1 } });
    await expect(page.locator('.cachorro-loko .record')).toHaveText('RECORDE 002');

    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page.getByText('Recorde: 2')).toBeVisible();
    const hub = new HubPage(page, game.ev);
    await hub.back();
    await expect(hub.card('cachorro-loko').locator('.hub-record')).toHaveText('Recorde 2');
  });

  test('CL-RN-26 nada pontua depois do fim do turno, nem um pacote que chega no mesmo quadro', async ({ game }) => {
    await game.play();
    // pré-condições: chapeiro parado, 1 vida e dois pacotes que chegam no mesmo quadro:
    // o primeiro (posto antes) toca o asfalto longe do cachorro e o segundo encosta no baú
    await game.chef(false);
    await game.setLives(1);
    const r = (await game.state()).catchRect;
    await game.dropAt('normal', 10, GROUND_Y - BOX_SIZE);
    const caught = await game.dropAt('normal', r.x + r.w / 2 - BOX_SIZE / 2, r.y - BOX_SIZE + 1);
    await game.frames(1);
    const s = await game.state();
    expect(s.phase).toBe('over');
    expect(s.score, 'o pacote do mesmo quadro não pontua').toBe(0);
    expect((await game.events()).some((e) => e.id === caught && e.ev === 'catch')).toBe(false);
    await game.frames(2 * 60);
    expect((await game.state()).score).toBe(0);
  });

  test('CL-RN-01 CL-RN-27 CL-RN-28 recorde salvo aparece no título; sair no meio da partida não salva o placar', async ({ game, page }) => {
    await game.openTitle({ storage: { [RECORD_KEY]: '1' } });
    await expect(page.getByText('Recorde: 1')).toBeVisible();
    await game.start();
    // pré-condição: chapeiro parado; dois pacotes postos em cima do cachorro
    await game.chef(false);
    await game.settle(await game.dropOnDog('normal'));
    await game.settle(await game.dropOnDog('normal'));
    await expect(page.locator('.cachorro-loko .record')).toHaveText('NOVO RECORDE!');
    await page.getByRole('button', { name: '← Menu' }).click();
    await expectStored(page, RECORD_KEY, '1');
    await expect(page.getByText('Recorde: 1')).toBeVisible();
  });
});
