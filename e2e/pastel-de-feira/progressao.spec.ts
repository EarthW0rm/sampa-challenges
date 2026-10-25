import { minReputation, profitGoal } from '../../src/games/pastel-de-feira/game/campaign/campaign';
import { seasonOf } from '../../src/games/pastel-de-feira/game/campaign/season';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { SEASON_NAME } from '../../src/games/pastel-de-feira/game/data/events';
import { UNLOCKS } from '../../src/games/pastel-de-feira/game/unlocks';
import { SAVE_KEY } from './support/campaign';
import { expect, test } from './support/game';

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rep1 = (r: number) => r.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const atDay = (day: number, extra: Partial<Campaign> = {}) => ({ patch: (c: Campaign) => ({ ...c, day, calendar: day, cash: 5000, ...extra }) });
/** Balões de dias anteriores já vistos: no dia N só aparece o do próprio dia. */
const seenBefore = (day: number) => ({ 'pastel-de-feira:visto': JSON.stringify(UNLOCKS.filter((u) => u.day < day).map((u) => u.id)) });

/** RN-50: meta de lucro R$ 70 × 1,12^(N−1) e reputação mínima 2,0 / 3,0 / 3,5; RN-140: estações de 5 dias. */
const DAYS = Array.from({ length: 20 }, (_, i) => i + 1);

test.describe('Progressão da campanha, dia a dia (Preparo)', () => {
  for (const day of DAYS) {
    test(`dia ${day}: meta ${money(profitGoal(day))} · reputação ${rep1(minReputation(day))}+ · ${SEASON_NAME[seasonOf(day)]}`, async ({ game, page }) => {
      await game.boot({ campaign: atDay(day), storage: seenBefore(day) });
      await game.continueToPrep();
      const head = page.locator('.pastel-de-feira .prep-head');
      await expect(head).toContainText(`Dia ${day}`);
      await expect(head).toContainText(`Meta: lucro ${money(profitGoal(day))} · reputação ${rep1(minReputation(day))}+`);
      await expect(page.getByRole('region', { name: 'Previsão do dia' })).toContainText(SEASON_NAME[seasonOf(day)]);
      // RN-171: o balão do sistema desbloqueado hoje (e só ele)
      const today = UNLOCKS.filter((u) => u.day === day);
      for (const u of today) {
        const aside = page.getByRole('status', { name: `Novidade: ${u.title}` });
        await expect(aside).toBeVisible();
        await aside.getByRole('button', { name: 'Entendi' }).click();
      }
      await expect(page.locator('.pastel-de-feira aside.unlock')).toHaveCount(0);
      // RN-17: o tema é pedido a partir do dia 5
      await expect(page.getByRole('dialog', { name: 'Tema da barraca' })).toHaveCount(day >= 5 ? 1 : 0);
    });
  }

  test('RN-50: a meta cresce 12% ao dia e a do dia 20 é R$ 602,89', () => {
    expect(profitGoal(1)).toBe(70);
    expect(profitGoal(20)).toBeCloseTo(602.89, 2);
    for (const d of DAYS.slice(1)) expect(profitGoal(d)).toBeGreaterThan(profitGoal(d - 1));
  });

  for (const [day, season] of [[21, 'Verão'], [26, 'Outono']] as const) {
    test(`RN-54/RN-140: modo livre, dia ${day}: sem meta e o ciclo das estações recomeça (${season})`, async ({ game, page }) => {
      await game.boot({ campaign: atDay(day, { freeMode: true }), storage: seenBefore(99) });
      await game.continueToPrep();
      await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Sem meta');
      await expect(page.getByRole('region', { name: 'Previsão do dia' })).toContainText(season);
    });
  }
});

/** RN-30 (desbloqueio por dia), RN-90, RN-100, RN-171: o que a aba Melhorias libera em cada dia. */
const GATED = [
  { name: 'Área de delivery', day: 5 },
  { name: 'Especial da Casa', day: 6 },
  { name: 'Palmito', day: 6 },
  { name: 'Carne Seca', day: 8 },
  { name: 'Escritório', day: 10 },
  { name: 'Camarão', day: 11 },
  { name: 'Bacalhau', day: 14 },
];

test.describe('Desbloqueios por dia na aba Melhorias', () => {
  for (const g of GATED) {
    test(`${g.name}: bloqueado no dia ${g.day - 1}, liberado no dia ${g.day}`, async ({ game, page }) => {
      const row = () => page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong').getByText(g.name, { exact: true }) }).first();
      // caixa e espaço sobrando: só o dia decide
      await game.boot({ campaign: { patch: (c) => ({ ...c, day: g.day - 1, calendar: g.day - 1, cash: 5000, owned: { ...c.owned, extraM2: 10 } }) }, storage: seenBefore(99) });
      await game.continueToPrep();
      await page.getByRole('tab', { name: 'Melhorias' }).click();
      await expect(row().locator('.warn')).toHaveText(`A partir do dia ${g.day}`);
      await expect(row().getByRole('button')).toBeDisabled();
      await page.evaluate((k) => {
        const s = JSON.parse(localStorage.getItem(k)!);
        s.campaign.day += 1;
        s.campaign.calendar += 1;
        localStorage.setItem(k, JSON.stringify(s));
      }, SAVE_KEY);
      await page.reload();
      await game.continueToPrep();
      if (g.day >= 5) await page.getByRole('dialog', { name: 'Tema da barraca' }).getByRole('button', { name: 'Decidir depois' }).click();
      await page.getByRole('tab', { name: 'Melhorias' }).click();
      await expect(row().locator('.warn')).toHaveCount(0);
      await expect(row().getByRole('button')).toBeEnabled();
    });
  }
});

/** RN-50 e RN-140 na prática: meta não cumprida repete o dia (e a estação do contador); o calendário anda. */
test.describe('Transições entre dias', () => {
  test('RN-50/RN-140: dia 5 sem vendas repete o dia 5, ainda no Verão, com o calendário no 6', async ({ game, page }) => {
    await game.startDay({ campaign: atDay(5), storage: seenBefore(99) });
    await game.runToEnd();
    await expect(page.getByText('Meta não cumprida. O dia 5 se repete.')).toBeVisible();
    await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
    await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Dia 5');
    await expect(page.getByRole('region', { name: 'Previsão do dia' })).toContainText('Verão');
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).campaign, SAVE_KEY);
    expect({ day: saved.day, calendar: saved.calendar }).toEqual({ day: 5, calendar: 6 });
  });

  test('RN-34: a massa vale 3 dias; no fim do 3º dia ela estraga no fechamento', async ({ game, page }) => {
    // massa comprada no calendário 1 (vence no 3); o dia jogado é o calendário 3
    await game.startDay({
      campaign: { patch: (c) => ({ ...c, day: 3, calendar: 3, inventory: c.inventory.map((l) => (l.ingredient === 'massa' ? { ...l, expires: 3 } : l)) }) },
      storage: seenBefore(99),
    });
    await game.runToEnd();
    await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
    await expect(page.locator('.pastel-de-feira li.item', { hasText: 'Massa' })).toContainText('tem 0');
  });

  test('RN-55: recarregar no fechamento não perde o dia (o save já é o do Preparo seguinte)', async ({ game, page }) => {
    await game.startDay({ campaign: atDay(2), storage: seenBefore(99) });
    await game.runToEnd();
    await page.reload();
    await expect(page.getByRole('button', { name: /^Continuar \(dia 2\)/ })).toBeVisible();
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(saved.phase).toBe('preparo');
    expect(saved.campaign.calendar).toBe(3);
  });
});
