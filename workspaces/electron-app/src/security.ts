import { session, shell, WebContents } from 'electron';
import { isAbsolute, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { isPackagedBuild } from './env';
import { getLogger } from './logger';

/** Where the Angular dev server runs; the only origin the renderer may navigate to in dev. */
export const DEV_SERVER_ORIGIN = 'http://localhost:4200';

/** The Angular browser build, copied here at build time (see scripts/copy-renderer.mjs). */
export const RENDERER_DIR = join(__dirname, '..', 'renderer');
export const RENDERER_INDEX = join(RENDERER_DIR, 'index.html');

export function applyProductionCsp() {
  // Only enforced when packaged, so the Angular dev server / live-reload isn't broken in dev.
  // 'unsafe-inline' on style-src is required because Angular's view encapsulation and Angular
  // Material inject inline <style> tags at runtime - an accepted trade-off, not an oversight.
  // 'unsafe-inline' on script-src-attr (not script-src, which stays free of it) is required
  // because Angular's production build emits an inline onload="" attribute on its stylesheet
  // <link> (a critical-CSS preload swap) - script-src-attr only permits inline event-handler
  // attributes like that one, not inline <script> blocks or javascript: URLs.
  // Fonts are bundled (@fontsource/*, see angular-app/src/styles.css), so no external origin
  // needs allowlisting here and the app renders identically offline.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; script-src-attr 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; font-src 'self'; " +
            "img-src 'self' data:; connect-src 'self';",
        ],
      },
    });
  });
}

/**
 * Is this URL part of the app itself? In dev that's the Angular dev server origin; when
 * packaged it's any file under the bundled renderer directory (and nothing outside it, so a
 * `file:///etc/passwd` or a traversal out of RENDERER_DIR is not "internal").
 *
 * Exported because handlersRegistry.ts checks IPC senders against exactly this notion of
 * "the app's own content" (see isTrustedSender there). The two must agree - a second copy of
 * this rule that drifted would either let a frame the navigation guards blocked go on
 * invoking IPC, or, far more likely, start rejecting the app's own calls after a change here.
 */
export function isInternalUrl(target: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }

  if (!isPackagedBuild()) {
    // Chromium's own inspector, which createWindow() opens in dev only. Guards are attached to
    // every webContents including DevTools', and blocking its internal navigation would be a
    // dev-only annoyance with nothing to gain - a renderer can't reach devtools: on its own.
    return parsed.protocol === 'devtools:' || parsed.origin === DEV_SERVER_ORIGIN;
  }

  if (parsed.protocol !== 'file:') {
    return false;
  }
  try {
    const path = relative(RENDERER_DIR, fileURLToPath(parsed));
    return path === '' || (!path.startsWith('..') && !isAbsolute(path));
  } catch {
    return false;
  }
}

/** Hand a URL to the user's browser, but only for schemes that are safe to shell out with. */
function openExternally(target: string): void {
  let protocol: string;
  try {
    protocol = new URL(target).protocol;
  } catch {
    return;
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    getLogger().warn(`Refused to open ${target} externally: unsupported scheme`);
    return;
  }
  void shell.openExternal(target);
}

/**
 * Items 12-13 of Electron's security checklist. Without these, a `target="_blank"` link or any
 * injected navigation opens an uncontrolled Chromium window (one that does not inherit this
 * app's webPreferences) or navigates the app itself off to an attacker-controlled page, where
 * the preload bridge is still attached. Everything that isn't the app's own content is denied
 * and handed to the user's real browser instead.
 */
export function attachNavigationGuards(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    getLogger().info(`Denied window.open for ${url}; handing it to the default browser`);
    openExternally(url);
    return { action: 'deny' };
  });

  const guard = (event: Electron.Event, url: string) => {
    if (isInternalUrl(url)) {
      return;
    }
    event.preventDefault();
    getLogger().warn(`Blocked navigation to ${url}`);
    openExternally(url);
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);

  // Nothing in this boilerplate uses <webview>; refusing it here means a compromised renderer
  // can't introduce one with weaker webPreferences than the main window's.
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
    getLogger().warn('Blocked an attempt to attach a <webview>');
  });
}
