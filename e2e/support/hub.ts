/**
 * Página do hub (home, cards, barra de volta) sobre a base comum. Usada pelos testes do hub e por
 * quem precisar navegar pela home (recorde no card depois de uma partida, troca de jogo).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { describer } from './describe';
import type { Evidence } from './evidence';
import { BaseGamePage, type BaseBootOptions } from './game-page';

/** Som e música de todos os jogos desligados (spec RN-19): o hub abre qualquer um. */
export const ALL_SOUND_OFF: Record<string, string> = {
  'capacete-voador:som': 'off',
  'corredor-sp:som': 'off',
  'fuga-rocam:som': 'off',
  'pinball-paulista:som': 'off',
  'sinuca-de-bar:som': 'off',
  'xadrez-paulistano:som': 'off',
  'pastel-de-feira:som': 'off',
  'pastel-de-feira:musica': 'off',
};

export interface CardInfo {
  id: string;
  title: string;
  /** Texto do recorde exibido no card (`null` se não houver). */
  record: string | null;
}

/** Cabeçalho das evidências do hub: rota, cards, jogo montado e laços de quadro vivos. */
export const hubDescriber = describer((w) => {
  const d = w.document;
  const out: [string, string][] = [['Rota', w.location.hash || '#/']];
  const cards = d.querySelectorAll('.hub-card').length;
  const game = d.querySelector('.hub-game');
  const mounted = game ? [...game.children].find((c) => !c.classList.contains('hub-bar'))?.className || '(carregando)' : null;
  out.push(['Tela', game ? `Jogo montado: ${mounted}` : d.querySelector('.hub-message') ? `Mensagem do hub: ${(d.querySelector('.hub-message')?.textContent ?? '').trim().slice(0, 100)}` : `Home (${cards} cards)`]);
  const pending = (w as unknown as { __e2eRafPending?: () => number }).__e2eRafPending;
  if (pending) out.push(['Laços', `${pending()} pedido(s) de quadro na fila`]);
  return out;
});

export class HubPage extends BaseGamePage {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: 'hub', path: './#/', root: '.hub-home', logical: { w: 1, h: 1 }, hookName: '__e2e', soundOff: ALL_SOUND_OFF });
  }

  override get route(): string {
    return '#/';
  }

  /** Abre a home. */
  open(opts: BaseBootOptions = {}): Promise<void> {
    return this.boot({ note: '(home do hub)', ...opts });
  }

  card(id: string): Locator {
    return this.page.locator('.hub-card').filter({ has: this.page.locator(`a[href="#/jogos/${id}"]`) });
  }

  /** Cards na ordem da home: id (pelo link), título e recorde exibido. */
  cards(): Promise<CardInfo[]> {
    return this.page.locator('.hub-card').evaluateAll((els) =>
      els.map((el) => ({
        id: (el.querySelector('a')?.getAttribute('href') ?? '').replace('#/jogos/', ''),
        title: (el.querySelector('h2')?.textContent ?? '').trim(),
        record: el.querySelector('.hub-record')?.textContent?.trim() ?? null,
      })),
    );
  }

  /** Clique no card do jogo; espera a raiz do jogo aparecer. */
  async openGame(id: string): Promise<void> {
    await this.ev.quiet(() => this.card(id).locator('a').click());
    await this.waitGame(id);
    await this.ev.action(`Clique no card "${id}": jogo aberto`);
  }

  /** Espera o jogo terminar de carregar (título, menu ou canvas visível dentro da raiz). */
  async waitGame(id: string): Promise<void> {
    await expect(this.page.locator(`.${id} h1, .${id} h2, .${id} canvas`).first()).toBeVisible();
  }

  /** Barra "← Sampa Challenges": volta para a home. */
  async back(): Promise<void> {
    await this.ev.quiet(() => this.page.getByRole('link', { name: '← Sampa Challenges' }).click());
    await expect(this.page.locator('.hub-home')).toBeVisible();
    await this.ev.action('Clique em "← Sampa Challenges": de volta à home');
  }
}
