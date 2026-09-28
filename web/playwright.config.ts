import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    // Point at a preinstalled Chromium if `npx playwright install chromium` is not an option.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: 'bash e2e/stack.sh',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
