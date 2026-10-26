import { BALLS_PER_GAME, BONUS_SECONDS, FLIPPER_REST } from '../../src/games/pinball-paulista/game/constants';
import { expectStored } from '../support/storage';
import { expectedBase, tallyTotal } from './support/rules';
import type { PinballPage } from './support/page';
import { expect, test } from './support/test';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const BONUS_FRAMES = Math.ceil(BONUS_SECONDS * 60) + 1;

async function bumper(game: PinballPage, i: number): Promise<void> {
  const b = (await game.targets()).bumpers[i];
  const before = (await game.state()).bumperHits[i];
  await game.placeBall(b.x, b.y - 31, 0, 150); // pré-condição: bola caindo no bumper
  await game.advanceUntil((h, a) => h.state().bumperHits[a.i] !== a.before, 1, { i, before }, 1);
}

test.describe('Pinball Paulista — bônus, bolas, fim de jogo e recorde', () => {
  test('PP-RN-22 PP-RN-23 PP-RN-24 PP-RN-25 PP-RN-16 bônus = base × mult, o que zera por bola, bola extra, 3 bolas, fim de jogo e recorde', async ({ game, page }) => {
    await game.open();
    const root = page.locator('.pinball-paulista');

    // bola 1: base de 2 bumpers e multiplicador ×3; bola extra pendente
    await game.launchIntoPlay();
    await game.lights({ saver: 60, nextAward: 'extra', kickCd: 0 }); // pré-condição: próximo prêmio = bola extra
    await game.placeBall(111, 215, 0, 80); // pré-condição: bola no Minhocão
    await game.advanceUntil((h) => h.state().extraPending, 3, undefined, 1);
    await bumper(game, 0);
    await bumper(game, 1);
    // pré-condição: multiplicador ×3, uma letra acesa, raias e semáforos com luz, sem segura-bola
    await game.lights({ mult: 3, letters: [true, false, false, false, false, false, false], rolls: [true, false, false], bumperHits: [4, 1, 0], saver: 0 });
    let s = await game.state();
    const base = s.bonusBase;
    expect(base).toBe(expectedBase(s.tally));
    const scoreBefore = s.score;
    await game.drainBall(); // pré-condição: bola no ralo
    await game.waitPhase('bonus', 2);
    s = await game.state();
    expect(s.bonus).toEqual({ base, mult: 3, total: base * 3 });
    expect(s.score).toBe(scoreBefore + base * 3);
    await expect(root.locator('.bonus h2')).toHaveText('BÔNUS DA BOLA');
    await expect(root.locator('.bonus p').first()).toHaveText(`${fmt(base)} × 3`);
    await expect(root.locator('.bonus-total')).toHaveText(`+${fmt(base * 3)}`);
    await game.ev.quiet(() => game.frames(BONUS_FRAMES));
    // bola extra: mesma bola de novo
    s = await game.state();
    expect(s.phase).toBe('ready');
    expect(s.ball).toBe(1);
    expect(s.message).toBe('BOLA EXTRA: LANCE!');
    expect(s.extraPending).toBe(false);
    // o que zera e o que fica
    expect(s).toMatchObject({ mult: 1, rolls: [false, false, false], bumperHits: [0, 0, 0], greens: 0, wave: 0, saver: 0, tilt: false, nudges: 0, bonusBase: 0 });
    expect(s.letters[0], 'letras ficam').toBe(true);

    // bola 1 (extra), 2 e 3: perdidas sem segura-bola; antes da última, o spinner fica girando
    for (const expected of [1, 2, BALLS_PER_GAME]) {
      expect((await game.state()).ball).toBe(expected);
      await game.launchIntoPlay();
      if (expected === BALLS_PER_GAME) {
        const sp = (await game.targets()).spinners[0];
        await game.placeBall(sp.x, sp.y + 25, 0, -420); // pré-condição: bola girando o spinner
        await game.ev.quiet(() => game.frames(20));
        expect((await game.state()).spin[0].w).toBeGreaterThan(20);
      }
      await game.lights({ saver: 0 }); // pré-condição: sem segura-bola
      await game.drainBall(); // pré-condição: bola no ralo
      await game.waitPhase('bonus', 2);
      await expect(root.locator('.bonus')).toBeVisible();
      await game.ev.quiet(() => game.frames(BONUS_FRAMES));
    }
    s = await game.state();
    expect(s.phase).toBe('over');
    const final = s.score;
    expect(tallyTotal(s.tally)).toBe(final);
    // depois do fim de jogo nada pontua (spinner ainda girando) e os flippers não sobem
    await game.keyDown('z', 300);
    await game.keyUp('z');
    s = await game.state();
    expect(s.score, 'placar congelado no fim de jogo').toBe(final);
    expect(s.flippers[0].angle).toBe(FLIPPER_REST);
    await game.pressKey('p');
    expect((await game.state()).phase, 'sem pausa no fim de jogo').toBe('over');

    const over = page.getByRole('dialog', { name: 'Fim de jogo' });
    await expect(over).toBeVisible();
    await expect(over.locator('.final-score')).toHaveText(`${fmt(final)} pontos`);
    await expect(over.locator('.final-record')).toHaveText('Novo recorde!');
    await expect(root.getByRole('button', { name: 'Pausar' })).toBeDisabled();
    await expectStored(page, 'pinball-paulista:recorde', String(final));

    await over.getByRole('button', { name: 'Jogar de novo' }).click();
    await game.ev.quiet(() => game.frames(120));
    s = await game.state();
    expect(s).toMatchObject({ phase: 'ready', ball: 1, score: 0, newRecord: false, record: final });
    expect(s.letters.some(Boolean)).toBe(false);
    await expect(root.locator('.rec')).toHaveText(fmt(final));

    await root.getByRole('button', { name: '← Menu' }).click();
    await expect(root.locator('.record')).toHaveText(`Recorde: ${final}`);
  });

  test('PP-RN-25 sair no meio da partida com recorde novo salva o recorde', async ({ game, page }) => {
    await game.open({ storage: { 'pinball-paulista:recorde': '50' } });
    const root = page.locator('.pinball-paulista');
    await expect(root.locator('.rec')).toHaveText('50');
    await game.launchIntoPlay();
    await game.lights({ saver: 60 }); // pré-condição: a bola não pode ser perdida
    await bumper(game, 0);
    const s = await game.state();
    expect(s.score).toBeGreaterThan(50);
    expect(s.newRecord).toBe(true);
    await expect(root.locator('.rec')).toHaveText('NOVO!');
    await expectStored(page, 'pinball-paulista:recorde', '50');
    await root.getByRole('button', { name: '← Menu' }).click();
    await expectStored(page, 'pinball-paulista:recorde', String(s.score));
    await expect(root.locator('.record')).toHaveText(`Recorde: ${s.score}`);
  });
});
