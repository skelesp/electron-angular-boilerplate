import { Injectable } from '@angular/core';
import { AppApiEvents, AppApiRegistry, ElectronAPI, Unsubscribe } from '@electron-angular-boilerplate/shared';

/**
 * The only place in the renderer that touches `window.electronAPI`. Every other service
 * goes through here, so the preload bridge has exactly one consumer and the typing
 * against the shared contract is enforced in exactly one place.
 */
@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private get api(): ElectronAPI | undefined {
    // The bridge is absent whenever the renderer isn't running inside Electron: a
    // component spec under jsdom, or `ng serve` opened in a normal browser. Reporting
    // that is more useful than a TypeError from deep inside a service.
    return typeof window === 'undefined' ? undefined : window.electronAPI;
  }

  /** Whether the preload bridge is present, i.e. whether this really is Electron. */
  get isAvailable(): boolean {
    return Boolean(this.api);
  }

  /** Request/response. Typed end to end against `AppApiRegistry`. */
  invoke<TChannel extends keyof AppApiRegistry>(
    channel: TChannel,
    data: AppApiRegistry[TChannel]['input']
  ): Promise<AppApiRegistry[TChannel]['output']> {
    const api = this.api;
    if (!api) {
      return Promise.reject(new Error(`Cannot invoke ${channel}: not running inside Electron`));
    }
    return api.invoke(channel, data);
  }

  /**
   * Subscribe to a main-process event. Returns the unsubscribe function - register it
   * with `DestroyRef.onDestroy` (see NoteService) rather than relying on the window
   * going away.
   */
  on<TChannel extends keyof AppApiEvents>(
    channel: TChannel,
    listener: (payload: AppApiEvents[TChannel]) => void
  ): Unsubscribe {
    const api = this.api;
    if (!api) {
      // A missing bridge means no events will ever arrive, which is a degraded but
      // working renderer - not a reason to fail construction of whoever subscribed.
      console.warn(`Not subscribing to ${channel}: not running inside Electron`);
      return () => undefined;
    }
    return api.on(channel, listener);
  }
}
