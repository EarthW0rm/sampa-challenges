import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaultPrice } from '../../src/games/pastel-de-feira/game/campaign/pricing';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { BASE_RECIPE_IDS, ITEMS } from '../../src/games/pastel-de-feira/game/data/recipes';
import { UNLOCKS } from '../../src/games/pastel-de-feira/game/unlocks';
import { expect, test } from './support/game';
import { buildCampaign, saveText } from './support/campaign';
import { fry, fryTimes, mill } from './support/flow';
import { hire } from './support/staff';

const ASSETS = fileURLToPath(new URL('../../src/games/pastel-de-feira/assets/', import.meta.url));

/** Combinações das regras novas na tela: tutorial com equipe, opções da campanha, selos e save. */
test.describe('Combinações', () => {
  test('RN-173/RN-55a: com equipe no tutorial do dia 1, o relógio anda mas o 2× segue bloqueado nos passos guiados', async ({ game, page }) => {
    await game.boot({ campaign: { options: { tutorial: true, unlockAll: true } } });
    await game.continueToPrep();
    await hire(game, 'Geral', 'Montagem 1');
    await game.openFair();
    const t0 = await game.tick();
    await game.frames(60);
    expect(await game.tick(), 'o relógio não para com equipe').toBeGreaterThan(t0);
    await expect(page.locator('.pastel-de-feira .tutorial-tip')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acelerar' })).toBeDisabled();
    await page.keyboard.press('KeyF');
    await game.frames(1);
    expect(await game.hook((pf) => pf.sim.state.speed)).toBe(1);
  });

  test('RN-55a/RN-171: começar no dia 10 mostra os balões de novidade um por vez, na ordem', async ({ game, page }) => {
    await game.boot({ campaign: null });
    await page.getByRole('button', { name: 'Nova campanha' }).click();
    await page.getByRole('combobox', { name: /Começar no dia/ }).selectOption('10');
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Dia 10');
    for (const u of UNLOCKS.filter((x) => x.day <= 10)) {
      const aside = page.getByRole('status', { name: `Novidade: ${u.title}` });
      await expect(aside).toBeVisible();
      await aside.getByRole('button', { name: 'Entendi' }).click();
    }
    await expect(page.locator('.pastel-de-feira aside.unlock')).toHaveCount(0);
  });

  test('Selos: todo sabor do jogo (receita base e caldo) tem o seu selo', () => {
    const keys = [...BASE_RECIPE_IDS, ...Object.values(ITEMS).filter((i) => i.kind === 'bebida').map((i) => i.id)];
    for (const k of new Set(keys)) expect(existsSync(`${ASSETS}icones/sabor_${k}.png`), `selo de ${k}`).toBe(true);
    expect(existsSync(`${ASSETS}ui/selo_versao.png`), 'pontinho da versão').toBe(true);
  });

  test('Selos: a versão melhorada (+1) leva o selo do próprio item; o caldo, o ícone do copo do sabor', async ({ game }) => {
    const upgraded = (c: Campaign): Campaign => ({
      ...c,
      owned: { ...c.owned, items: [...c.owned.items, 'carne+1'] },
      menu: { ...c.menu, salgados: ['carne+1', 'queijo'] },
      prices: { ...c.prices, 'carne+1': defaultPrice('carne+1') },
    });
    await game.startDay({ campaign: { stock: { massa: 30, carne: 20, mucarela: 20, azeitona: 20, cana: 20 }, patch: upgraded } });
    // pastel +1 montado pelo pasteleiro e frito no ponto
    await game.goTo('bancada');
    for (const ing of ITEMS['carne+1'].filling) {
      const ctl = (await game.controls()).find((c) => c.icon === `itens/ing_${ing}`)!;
      await game.tapControl(ctl.label);
    }
    await game.tapControl('FECHAR');
    const t = fryTimes('carne+1');
    await fry(game, (t.ponto[0] + t.ponto[1]) / 2);
    await mill(game, 6.1);
    await game.goTo('balcao');
    const ctl = await game.controls();
    expect(ctl.find((c) => c.flavor === 'carne+1'), 'o selo do +1 (desenhado com o pontinho da versão)').toBeTruthy();
    expect(ctl.find((c) => c.label === 'CALDO'), 'caldo').toMatchObject({ icon: 'icones/ctrl_caldo_puro' });
  });

  test('Selos: com a fila cheia, o balão mais largo (até 4 itens) não sai da zona da fila', async ({ game }) => {
    await game.startDay();
    await game.advanceUntil((pf) => pf.queue().length >= 6, 200, undefined, 60);
    const fila = await game.zone('fila');
    const balcao = await game.zone('balcao');
    const spots = await game.hook((pf) => pf.queue().map((q) => q.x));
    for (const x of spots) {
      const w = 14 * 4 + 6; // pior caso: 2 pastéis, 1 caldo e o brinde
      expect(x - w / 2, 'borda esquerda').toBeGreaterThanOrEqual(fila.x);
      expect(x + w / 2, 'borda direita: não invade o balcão').toBeLessThan(balcao.x);
    }
  });

  test('Save v2: opções corrompidas são recusadas sem travar (nova campanha)', async ({ game, page }) => {
    const c = buildCampaign();
    const broken = JSON.parse(saveText(c)) as { campaign: Record<string, unknown> };
    broken.campaign.settings = { staffFatigue: 'sim', unlockAll: false };
    await game.boot({ rawSave: JSON.stringify(broken) });
    await expect(page.getByText('Progresso salvo inválido — nova campanha.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova campanha' })).toBeVisible();
  });
});
