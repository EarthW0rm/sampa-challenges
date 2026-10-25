import { defineConfig, devices } from '@playwright/test';
import type { EvidenceOptions } from './pastel-de-feira/support/game';

/**
 * Testes de ponta a ponta no navegador (Playwright). Sobem o Vite em modo dev (StrictMode ligado,
 * como no desenvolvimento) e dirigem o jogo pelo DOM e por cliques no canvas.
 * Rodar: `npm run test:e2e` (todos) ou `npm run test:e2e -- pastel-de-feira/pedido`.
 */
const PORT = 5199;

export default defineConfig<EvidenceOptions>({
  testDir: '.',
  outputDir: '../test-results/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    // um clique que não acha o alvo falha em 15 s (sem isso ele espera até o timeout do teste)
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: [/responsivo\.spec\.ts/, /campanha-completa\.spec\.ts/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } },
    },
    {
      // campanha inteira (≈ 30 dias de jogo pela tela): longa, roda à parte com `npm run test:e2e:campanha`
      name: 'campanha',
      testMatch: /campanha-completa\.spec\.ts/,
      // pasta própria: a suíte rápida limpa `test-results/e2e` ao começar e apagaria os registros dos dias
      outputDir: '../test-results/e2e-campanha',
      // sem trace: são dezenas de milhares de gestos e o trace deixaria a execução muito lenta
      // evidências só dos marcos (início e fim de cada dia, fim do teste): uma por gesto seriam dezenas de milhares
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 }, trace: 'off', evidencias: 'marcos' },
    },
    {
      name: 'celular',
      testMatch: /responsivo\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
