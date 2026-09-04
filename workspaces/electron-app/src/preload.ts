// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
//
// Sandboxed preload scripts (webPreferences.sandbox: true, see main.ts) can't resolve
// arbitrary npm packages via require() at runtime, only Node builtins and 'electron' - so
// this file must always be built as a single bundled file with its dependencies (like
// isValidChannel from `shared`) inlined. That's what `npm run bundle:preload` (esbuild) does;
// don't replace it with a plain `tsc`-emitted dist/preload.js.

import { contextBridge, ipcRenderer } from 'electron';
import { AppApiRegistry, ElectronAPI, isValidChannel } from '@electron-angular-boilerplate/shared';

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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
