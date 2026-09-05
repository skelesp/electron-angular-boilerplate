import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { ThemeService } from '../services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless: no zone.js polyfill, no monkey-patched browser APIs, and change detection
    // driven by signals and template events instead. Everything in this renderer is
    // already signal-based, so there was nothing left for a Zone to notice on its behalf.
    provideZonelessChangeDetection(),
    // Routes an uncaught error or unhandled rejection in the renderer through Angular's
    // ErrorHandler instead of letting it die silently in a window nobody has DevTools open
    // on - which, in a packaged desktop app, is all of them.
    provideBrowserGlobalErrorListeners(),
    // Hash location, because a packaged build is served from `file://`: the path strategy
    // would ask the browser to pushState to a file URL, and a reload or a back/forward
    // would then try to load a file that isn't there. `#/settings` never leaves index.html.
    provideRouter(routes, withHashLocation()),
    // Nothing injects ThemeService until the (lazily loaded) settings page does, and the
    // app has to follow the OS from the first paint - so create it at startup.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ],
};
