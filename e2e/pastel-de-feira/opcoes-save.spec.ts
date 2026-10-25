import { hire as hireAction, rollCandidates } from '../../src/games/pastel-de-feira/game/campaign/actions/staff';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { expect, test, type GamePage } from './support/game';
import { buildCampaign } from './support/campaign';

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Compra uma oferta pela aba Melhorias. */
async function buy(game: GamePage, name: string | RegExp, price: number): Promise<void> {
  const page = game.page;
  await page.getByRole('tab', { name: 'Melhorias' }).click();
  const row = page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong', { hasText: name }) }).first();
  await row.getByRole('button', { name: money(price) }).click();
}

/** RN-55a (opções da campanha), RN-73 (cestos) e a migração do save v1 → v2. */
test.describe('Opções da campanha, cestos e save', () => {
  test('RN-55a: com as melhorias liberadas, a área de delivery entra no dia 1 e cria a Expedição', async ({ game }) => {
    await game.boot({ campaign: { options: { unlockAll: true }, patch: (c) => ({ ...c, cash: 3000 }) } });
    await game.continueToPrep();
    for (let i = 0; i < 3; i++) await buy(game, 'Mais 1 m²', 120);
    await buy(game, 'Área de delivery', 600);
    await game.openFair();
    expect(await game.hook((pf) => pf.env.layout.zones.map((z) => z.id))).toContain('expedicao');
  });

  test('RN-55a: sem a opção, a área de delivery no dia 1 fica travada até o dia 5', async ({ game, page }) => {
    await game.boot({ campaign: { patch: (c) => ({ ...c, cash: 3000, owned: { ...c.owned, extraM2: 3 } }) } });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Melhorias' }).click();
    const row = page.locator('.pastel-de-feira li.item').filter({ has: page.locator('strong', { hasText: 'Área de delivery' }) });
    await expect(row).toContainText('A partir do dia 5');
  });

  test('RN-73: cestos extras enchem o tacho 1 até 4 e depois passam ao tacho 2', async ({ game }) => {
    const two = (c: Campaign): Campaign => ({
      ...c, cash: 3000,
      owned: { ...c.owned, extraM2: 2, tachos: [...c.owned.tachos, { baskets: 2, oil: 'comum', thermostat: false, alarm: false, timer: false }] },
    });
    await game.boot({ campaign: { patch: two } });
    await game.continueToPrep();
    await buy(game, 'Cesto extra no tacho 1', 200);
    await buy(game, 'Cesto extra no tacho 1', 200);
    await buy(game, 'Cesto extra no tacho 2', 200);
    await game.openFair();
    const cestos = async (t: 'tacho1' | 'tacho2') => {
      await game.goTo(t);
      return (await game.controls()).filter((c) => c.label.startsWith('CESTO')).length;
    };
    expect(await cestos('tacho1')).toBe(4);
    expect(await cestos('tacho2')).toBe(3);
  });

  test('Save v1: quem estava fixo como Colocador abre como Montagem, com as opções padrão', async ({ game, page }) => {
    // save da versão anterior: posição "colocador1" e sem `settings`
    let c = buildCampaign({ patch: (x) => ({ ...x, day: 2, calendar: 2 }) });
    const cand = rollCandidates(c).find((k) => k.kind === 'geral')!;
    const r = hireAction(c, cand.id);
    if (!r.ok) throw new Error('fixture: contratação recusada');
    c = r.campaign;
    const { settings: _drop, ...old } = c;
    void _drop;
    const v1 = { ...old, staff: c.staff.map((w) => ({ ...w, mode: 'fixo', position: 'colocador1' })) };
    await game.boot({ rawSave: JSON.stringify({ version: 1, phase: 'preparo', campaign: v1 }) });
    await game.continueToPrep();
    await page.getByRole('tab', { name: 'Equipe' }).click();
    const sel = page.locator('.pastel-de-feira li.item.staff').first().getByRole('combobox');
    await expect(sel.locator('option:checked')).toHaveText('Montagem 1');
    // o próximo salvamento (checkpoint ao abrir a feira) já grava no formato novo
    await game.openFair();
    expect(await game.hook((pf) => pf.sim.state.workers.map((w) => w.position))).toEqual(['montagem1']);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pastel-de-feira:campanha')!));
    expect(saved.version).toBe(2);
    expect(saved.campaign.staff[0].position).toBe('montagem1');
    expect(saved.campaign.settings).toEqual({ staffFatigue: true, unlockAll: false });
  });
});
