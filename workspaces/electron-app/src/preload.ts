// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import {
  AppApiRegistry,
  ElectronAPI,
  isValidChannel,
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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log(
  '[Preload.ts] The preload script v1.0 has been loaded successfully.'
);
