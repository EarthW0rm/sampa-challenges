import { expect, test } from './support/test';

const LISAS: ['A', 'B'] = ['A', 'B'];

test.describe('Sinuca de Bar — bola castigo e fim de partida', () => {
  test('SB-RN-25 SB-RN-29 vence com a castigo na hora; diálogo, Ver mesa, Nova partida direto e Jogar de novo alterna a saída', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    // pré-condição rara: Ana (lisas) já limpou o grupo; a 8 na reta da caçapa
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 8, x: 160, y: 60 }, { n: 9, x: 250, y: 150 }], { groups: LISAS });
    const s = await game.shotAt(160, 60, 40);
    expect(s).toMatchObject({ winner: 0, endReason: 'Encaçapou a bola 8.', wins: [1, 0], phase: 'over' });
    const dialog = page.getByRole('dialog', { name: 'Fim de partida' });
    await expect(dialog.getByRole('heading', { name: 'Ana venceu!' })).toBeVisible();
    await expect(dialog.getByText('Placar: Ana 1 × 0 Bia')).toBeVisible();
    await expect(game.shootButton).toBeDisabled();
    await dialog.getByRole('button', { name: 'Ver mesa' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Nova partida' }).click();
    await game.frames(1);
    expect(await game.state(), 'partida encerrada: nova partida sem confirmação').toMatchObject({ winner: null, isBreak: true, breaker: 1, wins: [1, 0] });
  });

  test('SB-RN-29 Jogar de novo e Menu no diálogo do fim', async ({ game, page }) => {
    await game.start({ mode: 'pvp', names: ['Ana', 'Bia'] });
    // pré-condição rara: Ana na castigo
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 8, x: 160, y: 60 }, { n: 9, x: 250, y: 150 }], { groups: LISAS });
    await game.shotAt(160, 60, 40);
    await page.getByRole('button', { name: 'Jogar de novo' }).click();
    await game.frames(1);
    expect(await game.state()).toMatchObject({ winner: null, breaker: 1, turn: 1, wins: [1, 0] });
    // pré-condição rara: Bia na castigo
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 8, x: 160, y: 60 }, { n: 1, x: 250, y: 150 }], { turn: 1, groups: LISAS });
    await game.shotAt(160, 60, 40);
    await expect(page.getByText('Placar: Ana 1 × 1 Bia')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('heading', { name: 'SINUCA DE BAR' })).toBeVisible();
  });

  test('SB-RN-26 perde: castigo antes da hora, inclusive junto com a última do grupo', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara: Ana ainda tem a 1 na mesa
    await game.setTable([{ n: 0, x: 160, y: 120 }, { n: 8, x: 160, y: 60 }, { n: 1, x: 250, y: 150 }, { n: 9, x: 60, y: 160 }], { groups: LISAS });
    let s = await game.shotAt(160, 60, 40);
    expect(s).toMatchObject({ winner: 1, endReason: 'Encaçapou a bola 8 antes da hora.' });
    await game.page.getByRole('button', { name: 'Jogar de novo' }).click();
    // pré-condição rara: a 1 (última lisa) e a 8 caem na mesma tacada
    await game.setTable([{ n: 0, x: 92, y: 65 }, { n: 1, x: 106.5, y: 82 }, { n: 8, x: 155.5, y: 47 }, { n: 9, x: 250, y: 160 }], { groups: LISAS });
    s = await game.shotAt(105.5, 77.5, 50);
    expect(s.lastShot!.pocketed.sort()).toEqual([1, 8]);
    expect(s).toMatchObject({ winner: 1, endReason: 'Encaçapou a bola 8 antes da hora.' });
  });

  test('SB-RN-27 perde: branca junto com a castigo', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara: Ana na castigo; a branca segue a 8 para a caçapa
    await game.setTable([{ n: 0, x: 104, y: 172.5 }, { n: 8, x: 127, y: 172 }, { n: 9, x: 250, y: 160 }], { groups: LISAS });
    const s = await game.shotAt(130, 168, 50);
    expect(s.lastShot!.pocketed.sort()).toEqual([0, 8]);
    expect(s).toMatchObject({ winner: 1, endReason: 'Derrubou a branca junto com a bola 8.' });
  });

  test('SB-RN-28 perde: castigo encaçapada com falta', async ({ game }) => {
    await game.start({ mode: 'pvp' });
    // pré-condição rara: Ana na castigo; a branca toca a 9 primeiro e a 9 derruba a 8
    await game.setTable([{ n: 0, x: 133.5, y: 112.5 }, { n: 9, x: 123, y: 134 }, { n: 8, x: 148, y: 157.5 }], { groups: LISAS });
    const s = await game.shotAt(128.5, 133, 50);
    expect(s.lastShot).toMatchObject({ firstHit: 9, pocketed: [8] });
    expect(s).toMatchObject({ winner: 1, endReason: 'Falta na bola 8: tinha que tocar primeiro na bola 8.' });
    expect(s.toasts.filter((t) => t.startsWith('FALTA')), 'aviso da falta aparece uma vez').toHaveLength(1);
  });

  test('SB-RN-30 Nova partida pede confirmação por 3 s', async ({ game, page }) => {
    await game.start({ mode: 'pvp' });
    await page.getByRole('button', { name: 'Nova partida' }).click();
    const confirm = page.getByRole('button', { name: 'Abandonar esta partida?' });
    await expect(confirm).toBeVisible();
    // a janela de confirmação usa relógio real (3 s)
    await expect(page.getByRole('button', { name: 'Nova partida' })).toBeVisible({ timeout: 6000 });
    expect((await game.state()).breaker, 'sem o segundo toque nada muda').toBe(0);
    await page.getByRole('button', { name: 'Nova partida' }).click();
    await confirm.click();
    await game.frames(1);
    expect(await game.state()).toMatchObject({ breaker: 1, wins: [0, 0], winner: null });
  });
});
