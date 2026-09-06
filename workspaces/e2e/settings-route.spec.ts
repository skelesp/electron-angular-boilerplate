import { test, expect } from '@playwright/test';
import { launchPackagedApp } from './launchPackagedApp';

// Covers the two things about routing that only break once packaged: the lazily loaded
// route's chunk has to be fetched from `file://` under the production CSP, and the router
// has to navigate without asking the browser to pushState to a file URL (which is why
// app.config.ts uses withHashLocation).
test('the lazily loaded settings route opens in the packaged app', async () => {
  const app = await launchPackagedApp();

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.getByRole('link', { name: 'Settings' }).click();

    await expect(window.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    expect(window.url()).toContain('#/settings');

    // The theme comes from the main process (nativeTheme), so a rendered answer here means
    // the whole theme.get round trip worked, not just that the component loaded.
    await expect(window.getByText(/currently painting (light|dark)/)).toBeVisible();

    // Overriding the OS setting repaints the renderer: `color-scheme` on <html> is what
    // ThemeService writes, and every light-dark() value in the stylesheet follows it.
    await window.getByRole('button', { name: 'dark' }).click();
    await expect(window.locator('html')).toHaveCSS('color-scheme', 'dark');

    await window.getByRole('link', { name: 'Notes' }).click();
    await expect(window.getByRole('heading', { name: /^Notes/ })).toBeVisible();
  } finally {
    await app.close();
  }
});
