import { AI_MIN_DELAY_MS, E2E_NODES_PER_MS, LEVEL_MAX } from '../../src/games/xadrez-paulistano/game/constants';
import { levelLabel, levelProfile } from '../../src/games/xadrez-paulistano/game/levels';
import { FPS } from '../support/game-page';
import { NodeBrain } from './support/brain';
import { ANIM_FRAMES } from './support/page';
import { expect, test } from './support/test';

/** Quadros do atraso mínimo do computador. */
const DELAY_FRAMES = Math.ceil((AI_MIN_DELAY_MS / 1000) * FPS);

test.describe('Xadrez Paulistano — contra o computador', () => {
  test('XP-RN-24 XP-RN-26 brancas: nomes, lado de baixo, PENSANDO, tabuleiro parado e atraso mínimo', async ({ game, page }) => {
    await game.start({ mode: 'pvc', level: 1, color: 'Brancas', names: ['Ana'] });
    let s = await game.state();
    expect(s.humanColor).toBe('w');
    expect(s.bottom).toBe('w');
    expect(s.names).toEqual(['Ana', 'Computador 1']);
    await expect(page.locator('.xadrez-paulistano .mode-label')).toHaveText(`Contra o computador · nível 1 (${levelLabel(1)})`);
    await game.clickSquare('e2');
    await game.clickSquare('e4', ANIM_FRAMES);
    s = await game.state();
    expect(s.thinking || s.aiPending).toBe(true);
    expect(s.panel.status.startsWith('PENSANDO')).toBe(true);
    await game.clickSquare('e7');
    expect((await game.state()).selected, 'vez do computador: tabuleiro parado').toBeNull();
    // a resposta chega em tempo real; o lance só entra depois de AI_MIN_DELAY_MS de jogo desde o pedido
    await page.waitForFunction(() => !(window as unknown as { __e2e: { api: { state(): { thinking: boolean } } } }).__e2e.api.state().thinking, undefined, { polling: 20 });
    await game.frames(DELAY_FRAMES - 8);
    s = await game.state();
    expect(s.aiPending, 'antes do atraso mínimo').toBe(true);
    expect(s.moves).toHaveLength(1);
    await game.frames(8 + ANIM_FRAMES);
    s = await game.state();
    expect(s.moves).toHaveLength(2);
    expect(s.humanTurn).toBe(true);
    expect(s.canUndo).toBe(true);
    await game.press('Desfazer');
    expect((await game.state()).moves, 'Desfazer volta até a sua vez').toEqual([]);
  });

  test('XP-RN-24 XP-RN-19 pretas: o computador abre; Desfazer só depois do seu lance; Sorteio sorteia a cada partida', async ({ game }) => {
    await game.start({ mode: 'pvc', level: 1, color: 'Pretas', names: ['Ana'] });
    let s = await game.waitComputer();
    expect(s.humanColor).toBe('b');
    expect(s.bottom).toBe('b');
    expect(s.names).toEqual(['Computador 1', 'Ana']);
    expect(s.moves).toHaveLength(1);
    await expect(game.button('Desfazer')).toBeDisabled();
    const reply = new NodeBrain(1, 2000, 7).choose(s.startFen, s.ucis);
    await game.playUci(reply);
    s = await game.waitComputer();
    expect(s.moves).toHaveLength(3);
    await game.press('Desfazer');
    s = await game.state();
    expect(s.moves).toHaveLength(1);
    expect(s.turn).toBe('b');

    await game.press('← Menu');
    await game.menu({ color: 'Sorteio' });
    await game.play();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      s = await game.state();
      expect(['w', 'b']).toContain(s.humanColor);
      expect(s.bottom).toBe(s.humanColor);
      seen.add(s.humanColor!);
      await game.press('Nova partida');
      if (s.humanColor === 'b') await game.press('Abandonar esta partida?').catch(() => undefined);
      await game.frames(2);
    }
    expect(seen.size, 'as duas cores saem no sorteio').toBe(2);
  });

  test('XP-RN-27 nível: busca por faixa (pedido com o nível e o orçamento do perfil) e o nível alto vence o baixo', async ({ game }) => {
    test.setTimeout(180_000);
    await game.open();
    for (const level of [10, 50]) {
      await game.menu({ mode: 'pvc', level, color: 'Pretas' });
      await game.play();
      const s = await game.waitComputer();
      expect(s.lastAiRequest?.level).toBe(level);
      expect(s.lastAiRequest?.nodeBudget).toBe(Math.round(levelProfile(level).timeMs * E2E_NODES_PER_MS));
      await game.press('← Menu');
    }
    // o nível máximo (lado do Node, orçamento pequeno) contra o computador no nível 1, com semente fixa
    await game.menu({ level: 1, color: 'Brancas' });
    await game.play();
    const brain = new NodeBrain(LEVEL_MAX, 4000, 11);
    let s = await game.state();
    await game.ev.quiet(async () => {
      for (let ply = 0; ply < 200 && !s.outcome; ply++) {
        await game.playUci(brain.choose(s.startFen, s.ucis));
        s = await game.waitComputer();
      }
    });
    await game.evidence('Partida nível máximo × nível 1 terminada');
    expect(s.outcome).toEqual({ kind: 'checkmate', winner: 0 });
  });
});
