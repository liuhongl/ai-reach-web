import { defineConfig } from '@playwright/test';

const externalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  testIgnore: externalServer ? [] : ['**/*.fullstack.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: 'output/playwright/test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8078',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: externalServer
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:8078/user/login',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
