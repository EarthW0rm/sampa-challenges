import { writeFileSync } from 'node:fs';
import { daySeed, minReputation, profitGoal, toDayConfig } from '../../src/games/pastel-de-feira/game/campaign/campaign';
import { closeDay } from '../../src/games/pastel-de-feira/game/campaign/closing';
import { handoverValue } from '../../src/games/pastel-de-feira/game/campaign/actions/handover';
import { seasonOf } from '../../src/games/pastel-de-feira/game/campaign/season';
import type { Campaign } from '../../src/games/pastel-de-feira/game/campaign/types';
import { SEASON_NAME } from '../../src/games/pastel-de-feira/game/data/events';
import type { DayResult } from '../../src/games/pastel-de-feira/game/types';
import { pendingUnlock } from '../../src/games/pastel-de-feira/game/unlocks';
import { expect, test, type GamePage } from './support/game';
import { playDayByPilot } from './support/pilot';
import { applyPrep, readSave } from './support/prep';
import { planPrep, type LastDay } from './support/strategy';

const reais = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Mesmo formato da tela: negativo como "− R$ 73,00"; linha de custo zerada (−0) com "−". */
const money = (n: number) => (n < 0 && reais(-n) !== reais(0) ? `− ${reais(-n)}` : reais(Math.abs(n)));
const signedMoney = (n: number) => `${n < 0 || Object.is(n, -0) ? '−' : '+'} ${reais(Math.abs(n))}`;
const rep1 = (r: number) => r.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Rodadas de Dia de Feira no máximo (dias repetidos por meta não cumprida contam). */
const MAX_RUNS = 45;
/** Dias jogados em modo livre depois de zerar. */
const FREE_DAYS = 2;

/** Abas esperadas no Preparo (RN-171). */
function expectedTabs(c: Campaign): string[] {
  const t = ['Insumos', 'Cardápio', 'Melhorias'];
  if (c.day >= 2 || c.staff.length > 0) t.push('Equipe');
  if (c.owned.office) t.push('Escritório');
  if (c.day >= 3 || c.challenges.length > 0) t.push('Associação');
  return t;
}

async function summaryRows(game: GamePage): Promise<[string, string][]> {
  const rows = game.page.locator('.pastel-de-feira table.summary tr');
  const out: [string, string][] = [];
  for (let i = 0; i < (await rows.count()); i++) {
    out.push([(await rows.nth(i).locator('th').textContent())!.trim(), (await rows.nth(i).locator('td').textContent())!.trim()]);
  }
  return out;
}

/** Confere o Preparo do dia: cabeçalho, meta, estação, abas e balões de novidade. */
async function checkPrep(game: GamePage, c: Campaign, seen: string[]): Promise<void> {
  const page = game.page;
  const head = page.locator('.pastel-de-feira .prep-head');
  await expect(head).toContainText(`Dia ${c.day}`);
  await expect(head).toContainText(`Caixa ${money(c.cash)}`);
  await expect(head).toContainText(rep1(c.reputation));
  if (c.freeMode) {
    await expect(head).toContainText('modo livre');
    await expect(head).toContainText('Sem meta');
    await expect(page.getByRole('button', { name: 'Passar o ponto' })).toBeVisible();
  } else {
    await expect(head).toContainText(`Meta: lucro ${money(profitGoal(c.day))} · reputação ${rep1(minReputation(c.day))}+`); // RN-50
  }
  await expect(page.getByRole('region', { name: 'Previsão do dia' })).toContainText(SEASON_NAME[seasonOf(c.day)]); // RN-140
  expect(await page.getByRole('tab').allTextContents()).toEqual(expectedTabs(c)); // RN-171
  // balões de novidade: um por vez, na ordem, uma única vez (RN-171)
  for (let u = pendingUnlock(c.day, seen); u; u = pendingUnlock(c.day, seen)) {
    const aside = page.getByRole('status', { name: `Novidade: ${u.title}` });
    await expect(aside).toBeVisible();
    await aside.getByRole('button', { name: 'Entendi' }).click();
    seen.push(u.id);
  }
  await expect(page.locator('.pastel-de-feira aside.unlock')).toHaveCount(0);
  // tema (RN-17): a partir do dia 5 o Preparo pergunta; a estratégia decide depois
  if (c.day >= 5 && c.theme === null) {
    await page.getByRole('dialog', { name: 'Tema da barraca' }).getByRole('button', { name: 'Decidir depois' }).click();
  }
}

/** Confere o fechamento contra o `closeDay` do próprio jogo e devolve a campanha esperada depois dele. */
async function checkClosing(game: GamePage, before: Campaign, result: DayResult): Promise<{ after: Campaign; last: LastDay; met: boolean; bankrupt: boolean }> {
  const page = game.page;
  const out = closeDay(before, result);
  const b = out.balance;
  const rows = new Map(await summaryRows(game));
  for (const l of b.lines) expect(rows.get(l.label), `linha "${l.label}" do dia ${before.day}`).toBe(signedMoney(l.amount));
  expect(rows.get('Lucro líquido')).toBe(money(b.profit));
  expect(rows.get('Pedidos atendidos')).toBe(String(result.orders.served));
  expect(rows.get('Caixa')).toBe(money(out.campaign.cash));
  expect(rows.get('Reputação')).toContain(`${rep1(b.reputationBefore)} → ${rep1(b.reputationAfter)}`);
  if (b.goal !== null) expect(rows.get('Meta de lucro')).toBe(`${money(b.goal)} ${b.profitMet ? '✓' : '✗'}`);
  else expect(rows.has('Meta de lucro'), 'modo livre não tem meta de lucro').toBe(false);

  const msg = page.locator('.pastel-de-feira main.closing > p');
  if (b.bankrupt) await expect(msg).toHaveText('Caixa negativo: a barraca faliu.');
  else if (b.freeModeStarted) await expect(msg).toHaveText('Campanha zerada! Segue o modo livre, sem meta.');
  else if (before.freeMode) await expect(msg, 'modo livre é "sem meta" (RN-54)').toHaveText(`Modo livre, sem meta. Próximo: dia ${b.newDay}.`);
  else if (b.met) await expect(msg).toHaveText(`Meta cumprida. Próximo: dia ${b.newDay}.`);
  else await expect(msg).toHaveText(`Meta não cumprida. O dia ${b.newDay} se repete.`);

  // RN-50: o contador só avança com a meta; o calendário sempre avança
  expect(out.campaign.day).toBe(b.met ? before.day + 1 : before.day);
  expect(out.campaign.calendar).toBe(before.calendar + 1);
  // RN-55: o save do fechamento é a campanha que o jogo calculou
  const saved = await readSave(game);
  expect(saved.phase).toBe(b.bankrupt ? 'fim' : 'preparo');
  expect(saved.campaign).toEqual(out.campaign);
  const o = result.orders;
  return { after: out.campaign, last: { met: b.met, lost: o.lostPatience + o.noStock + o.queueFull }, met: b.met, bankrupt: b.bankrupt };
}

/**
 * Campanha inteira pela tela, do "Nova campanha" ao modo livre e ao "Passar o ponto" (Jornada principal,
 * JA-07, JA-08, RN-50–57, RN-140, RN-171). Preparo pelas abas (estratégia do robô equilibrado); dia jogado
 * pelo piloto, que transforma cada decisão do jogador automático em toque, segurar e soltar no canvas.
 * A cada dia o fechamento mostrado e o save são comparados com o `closeDay` do jogo.
 */
test('campanha completa: dia 1 ao dia 20, modo livre e passar o ponto', async ({ game, page }) => {
  test.setTimeout(60 * 60_000);
  await game.boot({ campaign: null });

  // Nova campanha pela tela (RN-51, RN-110)
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByRole('checkbox', { name: /Eventos/ }).uncheck();
  await page.getByRole('checkbox', { name: /Tutorial/ }).uncheck();
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.locator('.pastel-de-feira .prep')).toBeVisible();
  let c = (await readSave(game)).campaign;
  expect({ day: c.day, cash: c.cash, reputation: c.reputation, profile: c.profile }).toEqual({ day: 1, cash: 300, reputation: 3, profile: 'tradicional' });
  test.info().annotations.push({ type: 'semente', description: String(c.seed) });

  const seen: string[] = [];
  const log: string[] = [];
  let last: LastDay | undefined;
  let freeDays = 0;
  let bestDay = 0;
  let bestCash = 0;
  let runs = 0;
  for (; runs < MAX_RUNS; runs++) {
    // ---------- Preparo
    await checkPrep(game, c, seen);
    const { steps, expected } = planPrep(c, last);
    await applyPrep(game, steps);
    const prepSaved = await readSave(game);
    expect(prepSaved.campaign, `Preparo do dia ${c.day} (rodada ${runs + 1}): a tela tem que produzir a mesma campanha que as ações`).toEqual(expected);

    // RN-55: no meio da campanha, recarregar a página volta ao mesmo Preparo
    if (c.calendar === 10) {
      await page.reload();
      await game.continueToPrep();
      await expect(page.locator('.pastel-de-feira .prep-head')).toContainText(`Dia ${expected.day}`);
      await expect(page.locator('.pastel-de-feira .prep-head')).toContainText(`Caixa ${money(expected.cash)}`);
      if (expected.day >= 5 && expected.theme === null) await page.getByRole('dialog', { name: 'Tema da barraca' }).getByRole('button', { name: 'Decidir depois' }).click();
    }

    // ---------- Dia de Feira
    await game.openFair();
    expect(await game.hook((pf) => pf.sim.state.tick), 'o dia começa às 07:00 (o 1º quadro vale no máximo 50 ms = 3 passos)').toBeLessThanOrEqual(3);
    let dayStart = (await readSave(game)).campaign;
    expect(dayStart).toEqual(expected); // checkpoint do início do dia (RN-55)
    // JA-06: no calendário 8, sair no meio do dia e voltar recomeça o dia com novo sorteio
    if (c.calendar === 8) {
      await game.advance(60);
      await page.getByRole('button', { name: 'Pausar' }).click();
      await game.frames(7);
      await page.getByRole('dialog', { name: 'Jogo pausado' }).getByRole('button', { name: 'Sair' }).click();
      await expect(page.getByRole('heading', { name: 'SAMPA CHALLENGES' })).toBeVisible(); // o jogo desmonta antes de voltar
      await page.goto('./#/jogos/pastel-de-feira');
      await page.getByRole('button', { name: `Continuar (dia ${expected.day})` }).click();
      await game.waitForDay();
      expect(await game.hook((pf) => pf.sim.state.tick), 'recomeça às 07:00').toBeLessThanOrEqual(3);
      await game.frames(7);
      await expect(game.clock).toHaveText('07:00');
      dayStart = (await readSave(game)).campaign;
      expect(dayStart).toEqual({ ...expected, resumes: expected.resumes + 1 });
    }
    expect(await game.hook((pf) => pf.sim.state.config)).toEqual(toDayConfig(dayStart));
    void daySeed;
    await game.hook((pf) => pf.sim.startLog());
    const t0 = Date.now();
    const stats = await playDayByPilot(game);
    const secs = Math.round((Date.now() - t0) / 1000);
    expect(stats.misses, `gestos sem alvo no dia ${dayStart.day}`).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Fim da feira' })).toBeVisible();
    const result = await game.lastHook((pf) => pf.result!);
    // registro do dia (campanha inicial + comandos): permite reproduzir o dia sem tela (sim/run.ts --replay)
    const commands = await game.lastHook((pf) => pf.sim.commandLog());
    writeFileSync(test.info().outputPath(`dia-cal${dayStart.calendar}.json`), JSON.stringify({ campaign: dayStart, commands, result }));

    // ---------- Fechamento
    const closing = await checkClosing(game, dayStart, result);
    log.push(`rodada ${runs + 1}: dia ${dayStart.day}${dayStart.freeMode ? ' (livre)' : ''} variação de caixa ${Math.round((closing.after.cash - dayStart.cash) * 100) / 100} meta ${closing.met ? 'ok' : 'não'} caixa ${closing.after.cash} gestos ${stats.gestures} (${secs} s)`);
    console.log(log[log.length - 1]);
    expect(closing.bankrupt, `falência no dia ${dayStart.day}`).toBe(false);
    if (closing.met && !dayStart.freeMode) bestDay = Math.max(bestDay, dayStart.day);
    // RN-56: recorde de dia concluído e, em modo livre, de caixa
    if (bestDay > 0) expect(Number(await page.evaluate(() => localStorage.getItem('pastel-de-feira:recorde')))).toBeGreaterThanOrEqual(bestDay);
    if (closing.after.freeMode) {
      bestCash = Math.max(bestCash, closing.after.cash);
      // record.ts guarda os recordes em reais inteiros (Math.floor)
      expect(Number(await page.evaluate(() => localStorage.getItem('pastel-de-feira:recorde-caixa')))).toBe(Math.floor(bestCash));
    }
    if (dayStart.freeMode) freeDays++;
    last = closing.last;
    c = closing.after;
    await page.getByRole('button', { name: 'Preparar o próximo dia' }).click();
    await expect(page.locator('.pastel-de-feira .prep')).toBeVisible();
    if (freeDays >= FREE_DAYS) break;
  }
  expect(c.freeMode, `campanha zerada em até ${MAX_RUNS} rodadas`).toBe(true);
  expect(bestDay).toBe(20);
  expect(c.day).toBe(21 + FREE_DAYS);
  // RN-140: o ciclo das estações recomeça no modo livre
  await checkPrep(game, c, seen);

  // RN-56: o card do hub mostra o maior caixa em modo livre
  const record = Number(await page.evaluate(() => localStorage.getItem('pastel-de-feira:recorde-caixa')));
  await page.goto('./#/');
  const card = page.locator('.hub-card', { hasText: 'Pastel de Feira' });
  await expect(card).toContainText('Recorde');
  await expect(card, 'o recorde em modo livre é o maior caixa, em reais (RN-56)').toContainText(`Recorde ${money(record)}`);
  await page.goto('./#/jogos/pastel-de-feira');
  await page.getByRole('button', { name: /^Continuar/ }).click();

  // JA-08/RN-57: passar o ponto pelo caixa + 50% do investido; a campanha nova recebe R$ 200 + 20% (+ bônus do perfil)
  const value = handoverValue(c, 'zerado')!;
  if (c.theme === null) await page.getByRole('dialog', { name: 'Tema da barraca' }).getByRole('button', { name: 'Decidir depois' }).click();
  await page.getByRole('button', { name: 'Passar o ponto' }).click();
  const dialog = page.getByRole('dialog', { name: 'Passar o ponto' });
  await expect(dialog).toContainText(`Valor do ponto: ${money(value)}`);
  await dialog.getByRole('button', { name: 'Passar o ponto' }).click();
  await page.getByText('Negociante').click();
  await page.getByRole('button', { name: 'Começar' }).click();
  const next = (await readSave(game)).campaign;
  expect({ day: next.day, freeMode: next.freeMode, reputation: next.reputation, profile: next.profile, staff: next.staff.length }).toEqual({
    day: 1, freeMode: false, reputation: 3, profile: 'negociante', staff: 0,
  });
  expect(next.cash).toBeCloseTo(200 + 0.2 * value, 2);
  expect(Number(await page.evaluate(() => localStorage.getItem('pastel-de-feira:recorde-ponto')))).toBe(Math.floor(value));
  await expect(page.locator('.pastel-de-feira .prep-head')).toContainText('Dia 1');
});
