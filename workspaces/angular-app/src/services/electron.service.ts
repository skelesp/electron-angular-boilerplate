import { Injectable } from '@angular/core';
import { ElectronAPI, AppApiRegistry } from '@electron-angular-boilerplate/shared';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private get api(): ElectronAPI {
    return window.electronAPI;
  }

  invoke<TChannel extends keyof AppApiRegistry>(
    channel: TChannel,
    data: AppApiRegistry[TChannel]['input']
  ): Promise<AppApiRegistry[TChannel]['output']> {
    return this.api.invoke(channel, data);
  }
}
