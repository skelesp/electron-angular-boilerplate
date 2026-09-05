import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeEndpoints, themeEvents } from '@electron-angular-boilerplate/shared';

// The theme domain's store is Electron itself, so unlike the note handlers there is no
// in-memory database to point at - `nativeTheme` is the thing that has to be faked. The
// window list is faked too, so the events this handler emits can be observed.
const { mockNativeTheme, mockSend, mockBrowserWindow, listeners } = vi.hoisted(() => {
  const themeListeners: Record<string, () => void> = {};
  const send = vi.fn();
  return {
    listeners: themeListeners,
    mockSend: send,
    mockBrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send } }] },
    mockNativeTheme: {
      themeSource: 'system' as 'system' | 'light' | 'dark',
      shouldUseDarkColors: false,
      on: vi.fn((event: string, listener: () => void) => {
        themeListeners[event] = listener;
      }),
    },
  };
});

vi.mock('electron', () => ({
  nativeTheme: mockNativeTheme,
  BrowserWindow: mockBrowserWindow,
  app: { isPackaged: false },
}));

const { themeHandlers, startThemeWatcher } = await import('./theme.handler');

beforeEach(() => {
  vi.clearAllMocks();
  mockNativeTheme.themeSource = 'system';
  mockNativeTheme.shouldUseDarkColors = false;
});

describe('themeHandlers', () => {
  it('reports the resolved appearance, not just the requested source', async () => {
    mockNativeTheme.shouldUseDarkColors = true;

    const result = await themeHandlers[themeEndpoints.get.channel](undefined);

    expect(result).toEqual({ status: 'success', data: { source: 'system', shouldUseDarkColors: true } });
  });

  it('setSource writes through to nativeTheme so the native chrome follows too', async () => {
    await themeHandlers[themeEndpoints.setSource.channel]({ source: 'dark' });

    expect(mockNativeTheme.themeSource).toBe('dark');
  });

  it('setSource tells every window about the new state', async () => {
    mockNativeTheme.shouldUseDarkColors = true;

    await themeHandlers[themeEndpoints.setSource.channel]({ source: 'dark' });

    expect(mockSend).toHaveBeenCalledWith(themeEvents.changed.channel, {
      source: 'dark',
      shouldUseDarkColors: true,
    });
  });
});

describe('startThemeWatcher', () => {
  it('broadcasts the new state when the OS theme changes', () => {
    startThemeWatcher();
    expect(mockNativeTheme.on).toHaveBeenCalledWith('updated', expect.any(Function));

    mockNativeTheme.shouldUseDarkColors = true;
    listeners['updated']();

    expect(mockSend).toHaveBeenCalledWith(themeEvents.changed.channel, {
      source: 'system',
      shouldUseDarkColors: true,
    });
  });
});
