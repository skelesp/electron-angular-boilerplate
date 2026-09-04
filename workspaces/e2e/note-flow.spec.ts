import { test, expect, _electron as electron } from '@playwright/test';
import { resolvePackagedExecutable } from './resolvePackagedExecutable';

// Runs against the packaged app (not `localhost:4200`), specifically because bugs like a
// sandboxed preload script failing to resolve a dependency, or a CSP blocking something the
// dev server never enforces, only show up once app.isPackaged is true - a dev-mode test
// wouldn't catch them. Requires `npm run package -- --dir` to have already run (see root
// package.json's "test:e2e" script, which does both in order).
test('creating a note round-trips through IPC to SQLite and back', async () => {
  const app = await electron.launch({ executablePath: resolvePackagedExecutable() });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Timestamped so this doesn't collide with notes left behind by a previous e2e run - the
    // packaged app persists its SQLite file in the OS userData dir across runs, unlike the
    // in-memory DataSources the unit tests use.
    const title = `E2E note ${Date.now()}`;
    await window.getByPlaceholder('Title').fill(title);
    await window.getByPlaceholder('Content').fill('Created by Playwright');
    await window.getByRole('button', { name: 'Add note' }).click();

    await expect(window.getByText(title)).toBeVisible();
  } finally {
    await app.close();
  }
});
