// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
//
// Sandboxed preload scripts (webPreferences.sandbox: true, see main.ts) can't resolve
// arbitrary npm packages via require() at runtime, only Node builtins and 'electron' - so
// this file must always be built as a single bundled file with its dependencies (like
// isValidChannel from `shared`) inlined. That's what `npm run bundle:preload` (esbuild) does;
// don't replace it with a plain `tsc`-emitted dist/preload.js.

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AppApiEvents,
  AppApiRegistry,
  ElectronAPI,
  isValidChannel,
  isValidEventChannel,
  Unsubscribe,
} from '@electron-angular-boilerplate/shared';

// Type-safe wrapper for IPC communication
const electronAPI: ElectronAPI = {
  invoke: async <TChannel extends keyof AppApiRegistry>(
    channel: TChannel,
    data: AppApiRegistry[TChannel]['input']
  ): Promise<AppApiRegistry[TChannel]['output']> => {
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, data);
  },

  on: <TChannel extends keyof AppApiEvents>(
    channel: TChannel,
    listener: (payload: AppApiEvents[TChannel]) => void
  ): Unsubscribe => {
    // The same allowlist `invoke` applies, for the same reason: without it the renderer
    // could subscribe to any IPC channel in the process, including ones it has no
    // business seeing.
    if (!isValidEventChannel(channel)) {
      throw new Error(`Invalid event channel: ${channel}`);
    }

    // Only the payload crosses the bridge. Electron's IpcRendererEvent carries a `sender`
    // handle to the main process, and handing that to renderer code would undo most of
    // what contextIsolation is for.
    const subscription = (_event: IpcRendererEvent, payload: AppApiEvents[TChannel]) => listener(payload);
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
