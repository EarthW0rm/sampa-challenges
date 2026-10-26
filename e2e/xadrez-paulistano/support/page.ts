import { expect, type Locator, type Page } from '@playwright/test';
import type { XadrezE2E } from '../../../src/games/xadrez-paulistano/game/e2eHook';
import type { XadrezE2EState } from '../../../src/games/xadrez-paulistano/game/engine';
import { MOVE_ANIM_S } from '../../../src/games/xadrez-paulistano/game/constants';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, FPS, type BaseBootOptions } from '../../support/game-page';

/** Estado do gancho mais o centro lógico de cada casa (para o piloto). */
export type XState = XadrezE2EState & { squares: Record<string, { x: number; y: number }> };

export interface MenuOptions {
  mode?: 'pvc' | 'pvp';
  level?: number;
  color?: 'Brancas' | 'Pretas' | 'Sorteio';
  names?: [string, string?];
  autoFlip?: boolean;
}

/** Quadros que a peça leva deslizando (com folga de 2). */
export const ANIM_FRAMES = Math.ceil(MOVE_ANIM_S * FPS) + 2;

/** Página do Xadrez Paulistano: a base comum mais os gestos do jogo (menu, lances, botões). */
export class XadrezPage extends BaseGamePage<XadrezE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'xadrez-paulistano', logical: { w: 320, h: 200 }, hookName: '__e2e', soundOff: { 'xadrez-paulistano:som': 'off' } });
  }

  /** Abre o jogo e espera o menu. */
  async open(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot(opts);
    await expect(this.page.getByRole('heading', { name: 'XADREZ PAULISTANO' })).toBeVisible();
  }

  /** Preenche o menu (só o que vier em `o`) sem começar. */
  async menu(o: MenuOptions): Promise<void> {
    const p = this.page;
    await this.ev.quiet(async () => {
      if (o.mode) await p.locator(`.xadrez-paulistano input[name=mode][value=${o.mode}]`).check({ force: true });
      if (o.level !== undefined) await p.locator('#xadrez-level').fill(String(o.level));
      if (o.color) await p.locator('.xadrez-paulistano label.card-piece').filter({ hasText: o.color }).click();
      if (o.names) {
        const fields = p.locator('.xadrez-paulistano .field input');
        await fields.nth(0).fill(o.names[0]);
        if (o.names[1] !== undefined) await fields.nth(1).fill(o.names[1]);
      }
      if (o.autoFlip !== undefined) await p.getByLabel('Girar o tabuleiro para quem vai jogar').setChecked(o.autoFlip);
    });
    await this.ev.action(`Menu: ${JSON.stringify(o)}`);
  }

  /** Toca em **Jogar** e espera o tabuleiro e o gancho. */
  async play(): Promise<void> {
    await this.ev.quiet(() => this.page.getByRole('button', { name: 'Jogar', exact: true }).click());
    await expect(this.canvas).toBeVisible();
    await this.waitHook();
    await this.frames(2);
    await this.ev.action('Clique em "Jogar": partida aberta');
  }

  /** Abre o jogo, preenche o menu e começa a partida. */
  async start(o: MenuOptions = { mode: 'pvp' }, boot: BaseBootOptions = {}): Promise<void> {
    await this.open(boot);
    await this.menu(o);
    await this.play();
  }

  state(): Promise<XState> {
    return this.hook((h) => ({ ...h.state(), squares: h.targets().squares }));
  }

  /** Centro lógico de uma casa (`e4`), respeitando o giro. */
  square(name: string): Promise<{ x: number; y: number }> {
    return this.hook((h, n) => h.targets().squares[n], name);
  }

  /** Clique (ou toque) numa casa. */
  async clickSquare(name: string, frames = 1): Promise<void> {
    const c = await this.square(name);
    const p = await this.toClient(c.x, c.y);
    await this.ev.quiet(async () => {
      await this.page.mouse.move(p.x, p.y);
      await this.page.mouse.down();
      await this.page.mouse.up();
      await this.frames(frames);
    });
    await this.ev.action(`Clique na casa ${name}`);
  }

  /** Lance por clique-clique; espera a peça terminar de deslizar. */
  async move(from: string, to: string): Promise<void> {
    await this.ev.quiet(async () => {
      await this.clickSquare(from);
      await this.clickSquare(to, ANIM_FRAMES);
    });
    await this.ev.action(`Lance por clique: ${from} → ${to}`);
  }

  /** Sequência de lances por clique (`['e2e4', 'e7e5']`), com uma evidência só no fim. */
  async moves(list: string[]): Promise<void> {
    await this.ev.quiet(async () => {
      for (const m of list) await this.move(m.slice(0, 2), m.slice(2, 4));
    });
    await this.ev.action(`Lances por clique: ${list.join(' ')}`);
  }

  /** Arrasta a peça de uma casa até outra (ou até um ponto lógico qualquer). */
  async drag(from: string, to: string | { x: number; y: number }, steps = 8): Promise<void> {
    const a = await this.square(from);
    const b = typeof to === 'string' ? await this.square(to) : to;
    const pa = await this.toClient(a.x, a.y);
    const pb = await this.toClient(b.x, b.y);
    await this.ev.quiet(async () => {
      await this.page.mouse.move(pa.x, pa.y);
      await this.page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await this.page.mouse.move(pa.x + ((pb.x - pa.x) * i) / steps, pa.y + ((pb.y - pa.y) * i) / steps);
        await this.frames(1);
      }
      await this.page.mouse.up();
      await this.frames(2);
    });
    await this.ev.action(`Arrastar ${from} → ${typeof to === 'string' ? to : `(${Math.round(b.x)}, ${Math.round(b.y)}) lógico`}`);
  }

  /** Teclas em sequência (cada uma processada com 1 quadro). */
  async keys(list: string[]): Promise<void> {
    await this.ev.quiet(async () => {
      for (const k of list) {
        await this.page.keyboard.press(k);
        await this.frames(1);
      }
    });
    await this.ev.action(`Teclas ${list.join(' ')}`);
  }

  /** Escolhe a peça na janela de promoção. */
  async promote(piece: 'Dama' | 'Torre' | 'Bispo' | 'Cavalo' | 'Cancelar'): Promise<void> {
    await this.ev.quiet(async () => {
      await this.page.getByRole('dialog', { name: 'Promoção do peão' }).getByRole('button', { name: piece }).click();
      await this.frames(ANIM_FRAMES);
    });
    await this.ev.action(`Promoção: ${piece}`);
  }

  button(name: string | RegExp): Locator {
    return this.page.locator('.xadrez-paulistano').getByRole('button', { name, exact: typeof name === 'string' });
  }

  /** Clica num botão da tela; com `confirm`, clica de novo no botão de confirmação. */
  async press(name: string, confirm?: string): Promise<void> {
    await this.ev.quiet(async () => {
      await this.button(name).click();
      if (confirm) await this.button(confirm).click();
      await this.frames(2);
    });
    await this.ev.action(`Botão "${name}"${confirm ? ` e "${confirm}"` : ''}`);
  }

  /** Espera o computador jogar: busca real no worker, depois os quadros do atraso mínimo e da animação. */
  async waitComputer(timeoutMs = 30_000): Promise<XState> {
    await this.ev.quiet(async () => {
      for (let i = 0; i < 2000; i++) {
        const s = await this.state();
        if (s.outcome || (!s.thinking && !s.aiPending && !s.animating && s.humanTurn)) return;
        if (s.thinking) {
          await this.page.waitForFunction(
            () => {
              const h = (window as unknown as { __e2e?: { api: { state(): { thinking: boolean } } } | null }).__e2e;
              return !h || !h.api.state().thinking;
            },
            undefined,
            { polling: 20, timeout: timeoutMs },
          );
        }
        await this.frames(6);
      }
      throw new Error('o computador não jogou');
    });
    await this.ev.action('Computador jogou');
    return this.state();
  }

  /** Joga um lance UCI por clique (com a escolha da promoção, se houver), sem evidência própria. */
  async playUci(uci: string): Promise<void> {
    const labels: Record<string, 'Dama' | 'Torre' | 'Bispo' | 'Cavalo'> = { q: 'Dama', r: 'Torre', b: 'Bispo', n: 'Cavalo' };
    await this.ev.quiet(async () => {
      await this.clickSquare(uci.slice(0, 2));
      await this.clickSquare(uci.slice(2, 4), ANIM_FRAMES);
      if (uci.length > 4) await this.promote(labels[uci[4]]);
    });
  }

  /** Lista de lances exibida (texto de cada item). */
  listItems(): Promise<string[]> {
    return this.page.locator('.xadrez-paulistano .moves-list li').evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
  }

  /** Pré-condição rara (RN-15): começa a partida a partir de uma posição. */
  async prepareFen(fen: string): Promise<void> {
    await this.hook((h, f) => h.prepare.fen(f), fen);
    await this.frames(2);
    await this.ev.action(`Pré-condição: posição ${fen}`);
  }
}
