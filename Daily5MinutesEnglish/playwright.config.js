import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
  webServer: {
    command: 'php -S localhost:8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
  },
});
