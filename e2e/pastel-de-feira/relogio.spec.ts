import { DAY_SECONDS, DAY_TICKS, MAX_STEPS_PER_FRAME } from '../../src/games/pastel-de-feira/game/constants';
import { expect, expectSteps, test } from './support/game';

/** RN-01, RN-07, RN-173, JA-06, spec 4 (quadro inválido): relógio, pausa, aceleração. */
test.describe('Relógio do Dia de Feira', () => {
  test('RN-01: começa às 07:00 e o HUD acompanha o relógio do jogo', async ({ game }) => {
    await game.startDay();
    await expect(game.clock).toHaveText('07:00');
    await game.advance(DAY_SECONDS / 7); // 1 hora de jogo
    await game.frames(7); // o HUD atualiza a cada 100 ms
    await expect(game.clock).toHaveText('08:00');
    await game.advance(DAY_SECONDS / 2 - DAY_SECONDS / 7);
    await game.frames(7);
    await expect(game.clock).toHaveText('10:30');
  });

  test('RN-01/RN-07: o dia dura 240 s de jogo e termina no corte das 14h', async ({ game }) => {
    await game.startDay();
    await game.runToEnd();
    const ticks = await game.lastHook((pf) => pf.result?.ticks ?? -1);
    expect(ticks).toBe(DAY_TICKS);
  });

  test('RN-07: no corte seco ninguém fica na fila e quem estava lá sai sem falha', async ({ game }) => {
    await game.startDay();
    await game.advance(DAY_SECONDS - 2);
    const before = await game.hook((pf) => ({ queue: pf.sim.state.customers.length, failures: pf.sim.state.rep.failures }));
    await game.runToEnd();
    const after = await game.lastHook((pf) => ({ customers: pf.sim.state.customers.length, failures: pf.result!.reputation.weightedFailures }));
    expect(after.customers).toBe(0);
    // quem estava na fila às 13h58 pode ter perdido a paciência nos 2 s finais, mas o corte em si não soma falha
    expect(after.failures - before.failures).toBeLessThanOrEqual(before.queue);
  });

  test('JA-06: botão Pausa congela a simulação e mostra o menu; Continuar retoma', async ({ game, page }) => {
    await game.startDay();
    await game.frames(30);
    await page.getByRole('button', { name: 'Pausar' }).click();
    await game.frames(1);
    const t = await game.tick();
    await game.frames(120);
    expect(await game.tick()).toBe(t);
    const dialog = page.getByRole('dialog', { name: 'Jogo pausado' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await game.frames(60);
    expect(await game.tick()).toBeGreaterThan(t + 50);
    await expect(dialog).toBeHidden();
  });

  test('JA-06: tecla P pausa e retoma', async ({ game, page }) => {
    await game.startDay();
    await page.keyboard.press('KeyP');
    await game.frames(1);
    const t = await game.tick();
    await game.frames(60);
    expect(await game.tick()).toBe(t);
    await page.keyboard.press('KeyP');
    await game.frames(60);
    expectSteps(await game.tick(), t + 60);
  });

  test('JA-06: perder o foco da aba pausa o dia', async ({ game, page }) => {
    await game.startDay();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await game.frames(1);
    const t = await game.tick();
    await game.frames(60);
    expect(await game.tick()).toBe(t);
    await expect(page.getByRole('dialog', { name: 'Jogo pausado' })).toBeVisible();
  });

  test('JA-06: com o jogo pausado, toques no canvas não viram comandos', async ({ game, page }) => {
    await game.startDay();
    await page.getByRole('button', { name: 'Pausar' }).click();
    await game.frames(1);
    const z = await game.zone('moenda');
    const p = await game.toClient(z.x + z.w / 2, z.y + z.h / 2);
    // o overlay cobre o canvas: o evento vai direto ao canvas, como um toque que escapasse do overlay
    await game.canvas.dispatchEvent('pointerdown', { clientX: p.x, clientY: p.y, pointerId: 1, isPrimary: true, button: 0 });
    await game.canvas.dispatchEvent('pointerup', { clientX: p.x, clientY: p.y, pointerId: 1, isPrimary: true, button: 0 });
    await game.frames(30);
    expect(await game.hook((pf) => pf.sim.state.pasteleiro.to)).toBeNull();
  });

  test('RN-173: botão 1×/2× dobra os passos por quadro', async ({ game, page }) => {
    await game.startDay();
    const speed = page.getByRole('button', { name: 'Acelerar' });
    await expect(speed).toHaveText('1×');
    await speed.click();
    await game.frames(1);
    const t = await game.tick();
    await game.frames(60);
    expectSteps(await game.tick(), t + 120);
    await game.frames(7);
    await expect(speed).toHaveText('2×');
    await expect(speed).toHaveAttribute('aria-pressed', 'true');
    await speed.click();
    await game.frames(1);
    const t2 = await game.tick();
    await game.frames(60);
    expectSteps(await game.tick(), t2 + 60);
  });

  test('RN-173/RN-174: tecla F alterna a velocidade', async ({ game, page }) => {
    await game.startDay();
    await page.keyboard.press('KeyF');
    await game.frames(1);
    const t = await game.tick();
    await game.frames(30);
    expectSteps(await game.tick(), t + 60);
  });

  test('spec 4: quadro gigante (aba em segundo plano) não pula mais que o teto de passos', async ({ game }) => {
    await game.startDay();
    const t = await game.tick();
    await game.jump(10_000); // um único quadro 10 s depois do anterior
    await game.frames(1);
    expect((await game.tick()) - t).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME);
  });
});
