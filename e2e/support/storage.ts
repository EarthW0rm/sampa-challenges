/** Leitura do `localStorage` da página (recorde, config, som) para conferir o que o jogo gravou. */
import { expect, type Page } from '@playwright/test';

export function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }, key);
}

export async function expectStored(page: Page, key: string, value: string | null): Promise<void> {
  expect(await readStorage(page, key), `localStorage["${key}"]`).toBe(value);
}
