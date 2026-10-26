import { expectStored } from '../support/storage';
import { expect, test } from './support/test';

const KEY = 'capacete-voador:som';

test.describe('Capacete Voador — som', () => {
  test('CV-RN-32 som liga e desliga pela barra e a escolha vale na próxima abertura', async ({ game, page }) => {
    await game.play();
    const btn = page.getByRole('button', { name: /^Som:/ });
    await expect(btn).toHaveText('Som: desligado');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveText('Som: ligado');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expectStored(page, KEY, 'on');

    await page.reload();
    await game.start();
    await expect(btn, 'escolha lembrada').toHaveText('Som: ligado');
    await btn.click();
    await expect(btn).toHaveText('Som: desligado');
    await expectStored(page, KEY, 'off');
  });
});
