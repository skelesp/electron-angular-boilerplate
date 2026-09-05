import { computed, DestroyRef, DOCUMENT, effect, inject, Injectable, resource } from '@angular/core';
import { apiRegistry, eventRegistry, ThemeSource, ThemeState } from '@electron-angular-boilerplate/shared';
import { ElectronService } from './electron.service';

/**
 * Follows (or overrides) the operating system's dark mode.
 *
 * The main process is the source of truth, not `prefers-color-scheme`: Electron's
 * `nativeTheme` is what also decides how the *native* parts of the app look - title bar,
 * menus, dialogs - so letting the renderer decide on its own would give you a dark window
 * with a light title bar the moment anyone overrides the OS setting.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly electronService = inject(ElectronService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  /**
   * What to assume until the main process answers - and, in a plain browser (`ng serve`
   * with no Electron around it), forever. Chromium already knows what the OS wants, so
   * seeding from it keeps the first paint right instead of flashing light.
   */
  readonly #initialTheme: ThemeState = {
    source: 'system',
    shouldUseDarkColors: this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  };

  readonly #theme = resource({
    loader: async () => {
      const response = await this.electronService.invoke(apiRegistry.theme.get.channel, undefined);
      if (response.status === 'error') {
        throw new Error(response.error.details);
      }
      return response.data;
    },
    defaultValue: this.#initialTheme,
  });

  readonly theme = computed(() => (this.#theme.hasValue() ? this.#theme.value() : this.#initialTheme));
  readonly source = computed(() => this.theme().source);
  readonly isDark = computed(() => this.theme().shouldUseDarkColors);

  constructor() {
    const unsubscribe = this.electronService.on(eventRegistry.theme.changed.channel, (state) => {
      // Unlike `note.changed`, this event carries the whole new state, so there is nothing
      // to re-fetch - write it straight into the resource instead of reloading it.
      this.#theme.set(state);
    });
    this.destroyRef.onDestroy(unsubscribe);

    // `color-scheme` is what actually repaints the app: every `light-dark()` value in
    // styles.css resolves against it, and so do the scrollbars and form controls the
    // browser draws itself.
    effect(() => {
      this.document.documentElement.style.colorScheme = this.isDark() ? 'dark' : 'light';
    });
  }

  /** Override the OS setting, or hand control back to it with 'system'. */
  async setSource(source: ThemeSource): Promise<void> {
    const response = await this.electronService.invoke(apiRegistry.theme.setSource.channel, { source });
    if (response.status === 'success') {
      // The main process answers with the resolved state, so the UI doesn't have to wait
      // for the `theme.changed` broadcast to come back around.
      this.#theme.set(response.data);
    }
  }
}
