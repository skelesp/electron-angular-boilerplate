import { app, dialog } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { autoUpdater } from 'electron-updater';
import { getLogger } from './logger';

/**
 * A long-running desktop app can stay open for days, so a single check at startup would miss
 * everything published in between. Six hours is frequent enough to matter and rare enough not
 * to be noise.
 */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let recheckTimer: NodeJS.Timeout | null = null;

/**
 * electron-updater reads its feed URL from `app-update.yml`, which electron-builder writes into
 * the packaged app's resources - but only when a publish provider resolves at build time (the
 * root package.json's `build.publish`, or the git remote). A build made without one has no
 * feed to talk to, and asking electron-updater to check anyway just throws.
 */
function hasUpdateFeed(): boolean {
  // resourcesPath is only defined inside a real Electron process; no resources dir, no feed.
  return Boolean(process.resourcesPath) && existsSync(join(process.resourcesPath, 'app-update.yml'));
}

async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    // Never fatal: no network, a release that isn't published yet, or an unsigned macOS build
    // (see the signing note below) all surface here, and none of them are a reason to stop the
    // app the user actually launched.
    getLogger().warn('Update check failed:', error);
  }
}

/**
 * Wires electron-updater to check GitHub Releases for a newer version, download it in the
 * background and install it on quit. Safe to call unconditionally - it deliberately does
 * nothing in the cases where updating cannot work:
 *
 * - **In development** (`!app.isPackaged`) there is no installed app to replace.
 * - **Without an update feed** - see `hasUpdateFeed()`. This is what makes a `--dir` build (the
 *   one `npm run test:e2e` and CI package) and any fork that hasn't published a release yet
 *   start up cleanly instead of erroring on launch.
 *
 * Two things a consumer of this template has to supply before updates actually reach users:
 *
 * 1. **A published (non-draft) GitHub Release** for the repo the app was built from. The
 *    release workflow (`.github/workflows/release.yml`) creates *drafts* on purpose, so
 *    nothing ships until a human publishes it; electron-updater cannot read a draft.
 * 2. **Code signing.** On macOS this is not optional: Squirrel.Mac refuses to swap in an app
 *    whose signature doesn't match the running one, so auto-update on an unsigned/un-notarized
 *    build always fails (it is logged, and the app keeps running). On Windows an unsigned NSIS
 *    update installs fine but SmartScreen warns the user. Linux AppImage updates need neither.
 *    This template configures no signing - see the "Auto-update" section of CLAUDE.md.
 */
export function initializeAutoUpdater(): void {
  if (!app.isPackaged) {
    getLogger().debug('Auto-update disabled: not a packaged build');
    return;
  }

  if (!hasUpdateFeed()) {
    getLogger().info('Auto-update disabled: no app-update.yml in this build');
    return;
  }

  autoUpdater.logger = getLogger();
  // The update is fetched in the background and swapped in on the next quit, so the user is
  // only ever interrupted by the prompt below - never by a download they have to wait for.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    getLogger().info(`Update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    getLogger().debug('No update available');
  });

  autoUpdater.on('error', (error) => {
    getLogger().warn('Auto-updater error:', error);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    getLogger().info(`Update downloaded: ${info.version}`);

    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `${app.getName()} ${info.version} is ready to install.`,
      detail: 'The update will be applied the next time the app starts.',
    });

    if (response === 0) {
      // autoInstallOnAppQuit already covers "Later"; this just brings that forward.
      autoUpdater.quitAndInstall();
    }
  });

  void checkForUpdates();
  recheckTimer = setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);

  app.once('before-quit', () => {
    if (recheckTimer) {
      clearInterval(recheckTimer);
      recheckTimer = null;
    }
  });
}
