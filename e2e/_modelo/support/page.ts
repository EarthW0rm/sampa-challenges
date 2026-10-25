import type { Page } from '@playwright/test';
import type { __COMPONENTE__E2E } from '../../../src/games/__ID__/game/e2eHook';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage } from '../../support/game-page';

/** Página do __TITULO__: a base comum mais os gestos do jogo. */
export class __COMPONENTE__Page extends BaseGamePage<__COMPONENTE__E2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, { id: '__ID__', logical: { w: 320, h: 200 }, hookName: '__e2e', soundOff: {} });
  }

  /** Abre o jogo e espera o gancho. */
  async open(seed = 1): Promise<void> {
    await this.boot({ seed });
    await this.waitHook();
  }

  /** Anda segurando uma seta por `frames` quadros. */
  move(key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', frames: number): Promise<void> {
    return this.holdKey(key, frames);
  }

  player(): Promise<{ x: number; y: number }> {
    return this.hook((h) => h.state().player);
  }
}
