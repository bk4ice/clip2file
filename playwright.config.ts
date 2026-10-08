import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  timeout: 60000,
  reporter: 'list',
});
