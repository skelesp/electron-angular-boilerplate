import { AppApiEvents, AppApiRegistry } from './registry.js';
import { Unsubscribe } from './types.js';

export interface ElectronAPI {
  /** Request/response: ask the main process for something and await its `ApiResponse`. */
  invoke<TChannel extends keyof AppApiRegistry>(
    channel: TChannel,
    data: AppApiRegistry[TChannel]['input']
  ): Promise<AppApiRegistry[TChannel]['output']>;

  /**
   * Push: subscribe to an event the main process emits on its own schedule. Returns an
   * unsubscribe function - call it when the listener's owner goes away, or the renderer
   * leaks a listener per subscription for the lifetime of the window.
   */
  on<TChannel extends keyof AppApiEvents>(
    channel: TChannel,
    listener: (payload: AppApiEvents[TChannel]) => void
  ): Unsubscribe;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
