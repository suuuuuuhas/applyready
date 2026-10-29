import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 180_000,
  expect: { timeout: 25_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:4173', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : undefined },
  webServer: process.env.TEST_BASE_URL ? undefined : { command: 'npm run preview -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
})
