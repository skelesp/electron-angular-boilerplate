import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      // Nothing in this suite launches Electron - the packaged app is workspaces/e2e's job -
      // but importing the package still resolves its entry point, and since Electron 44 that
      // entry downloads the ~100 MB binary on demand when `node_modules/electron/dist` is
      // missing, rather than at install time. Vitest runs each spec file in its own worker,
      // so on a machine that has never launched or packaged the app - every CI runner - a
      // handful of workers fire that download at once and race each other extracting the same
      // zip ("failed to create '.../LICENSES.chromium.html': File exists"), leaving whichever
      // worker lost to fail with "Electron failed to install correctly".
      //
      // ELECTRON_OVERRIDE_DIST_PATH short-circuits that: the entry joins this path and returns
      // it without checking the filesystem or installing anything. The path is never opened -
      // `electron` still resolves to a path string, so `app`, `ipcMain` and the rest read as
      // undefined, which is exactly what these specs already assume (see CLAUDE.md, "Nothing
      // in electron-app touches Electron at import time"). It has to be an environment
      // variable rather than a Vite alias because electron-log and electron-updater reach for
      // `require('electron')` themselves, through Node's resolution, where aliases don't apply.
      ELECTRON_OVERRIDE_DIST_PATH: '/electron-is-not-installed-during-unit-tests',
    },
    coverage: {
      provider: 'v8',
      // 'text-summary' keeps the CI log short; 'lcov' is the machine-readable format every
      // coverage service and IDE gutter plugin understands. Only produced with --coverage.
      reporter: ['text-summary', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/test-utils/**'],
    },
  },
});
