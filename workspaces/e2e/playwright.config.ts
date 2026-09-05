import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  fullyParallel: false, // one packaged Electron instance at a time
  // ...and one worker, for the same reason: the app takes a single-instance lock (see
  // electron-app/src/main.ts), so a second spec file starting in parallel would launch an
  // app that immediately quits again.
  workers: 1,
  retries: 0,
  reporter: 'list',
});
