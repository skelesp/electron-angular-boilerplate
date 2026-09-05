import {
  GetThemeOutput,
  Handlers,
  SetThemeSourceInput,
  SetThemeSourceOutput,
  ThemeApiEndpoints,
  ThemeState,
  themeEndpoints,
  themeEvents,
} from '@electron-angular-boilerplate/shared';
import { nativeTheme } from 'electron';
import { emitAppEvent } from '../../events';

/**
 * A domain with no entity, no repository and no mapper: the store is the operating system,
 * reached through Electron's `nativeTheme`. It lives alongside the persisted domains
 * anyway, because what makes a domain a domain here is the contract in `shared`, not where
 * its data happens to come from.
 *
 * `nativeTheme` is read inside these functions rather than at module load, for the same
 * reason every other Electron global is - see env.ts.
 */
function currentTheme(): ThemeState {
  return {
    source: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
}

class ThemeHandler {
  async getTheme(): Promise<GetThemeOutput> {
    return { status: 'success', data: currentTheme() };
  }

  async setThemeSource(input: SetThemeSourceInput): Promise<SetThemeSourceOutput> {
    // Setting this is what makes the *native* parts of the app - title bar, menus, dialogs,
    // scrollbars - follow along with the renderer, which is the whole reason the renderer
    // doesn't just read `prefers-color-scheme` and decide for itself.
    nativeTheme.themeSource = input.source;

    const state = currentTheme();
    // Electron only emits 'updated' when the *resolved* appearance changes, so switching
    // from 'system' to 'dark' while the OS is already dark would tell no one. Emitting here
    // covers that; the duplicate event when the resolved value did change is a re-push of
    // identical state, which costs a renderer nothing.
    emitAppEvent(themeEvents.changed.channel, state);
    return { status: 'success', data: state };
  }
}

const themeHandler = new ThemeHandler();
export const themeHandlers: Handlers<ThemeApiEndpoints> = {
  [themeEndpoints.get.channel]: themeHandler.getTheme.bind(themeHandler),
  [themeEndpoints.setSource.channel]: themeHandler.setThemeSource.bind(themeHandler),
} as const;

/**
 * Push the resolved theme to every window whenever the OS changes it. Called once from
 * `whenReady` - the renderer gets the initial value by asking (`theme.get`), and every
 * change after that arrives without it having to poll.
 */
export function startThemeWatcher(): void {
  nativeTheme.on('updated', () => {
    emitAppEvent(themeEvents.changed.channel, currentTheme());
  });
}
