import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  fullyParallel: false, // one packaged Electron instance at a time
  retries: 0,
  reporter: 'list',
});
