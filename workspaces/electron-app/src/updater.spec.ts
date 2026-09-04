import { describe, it, expect, beforeEach, vi } from 'vitest';

// updater.ts reads `app` from 'electron' and pulls in logger.ts, which reads app.isPackaged at
// module load time - both crash outside a real Electron process. `electron-updater` is mocked
// too so the test never opens a network connection.
const { mockApp, mockAutoUpdater, mockExistsSync } = vi.hoisted(() => ({
  mockApp: { isPackaged: false, getName: () => 'Test App', once: vi.fn() },
  mockAutoUpdater: {
    logger: null as unknown,
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue(null),
  },
  mockExistsSync: vi.fn(),
}));

vi.mock('electron', () => ({ app: mockApp, dialog: { showMessageBox: vi.fn() } }));
vi.mock('electron-updater', () => ({ autoUpdater: mockAutoUpdater }));
vi.mock('fs', () => ({ existsSync: mockExistsSync }));

const { initializeAutoUpdater } = await import('./updater');

describe('initializeAutoUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApp.isPackaged = false;
    mockExistsSync.mockReturnValue(true);
    // Only ever set inside a real Electron process.
    process.resourcesPath = '/resources';
  });

  it('does nothing in development, where there is no installed app to replace', () => {
    initializeAutoUpdater();

    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  // This is the case every `--dir` build hits, including the one the e2e suite and CI package:
  // electron-builder only writes app-update.yml for real installer targets, so without this
  // guard the packaged app would error on launch.
  it('does nothing when the build has no app-update.yml to read a feed from', () => {
    mockApp.isPackaged = true;
    mockExistsSync.mockReturnValue(false);

    initializeAutoUpdater();

    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('wires the update events and checks once when packaged with a feed', () => {
    mockApp.isPackaged = true;

    initializeAutoUpdater();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(mockAutoUpdater.on.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(['update-available', 'update-downloaded', 'error'])
    );
  });

  it('swallows a failing update check rather than taking the app down with it', async () => {
    mockApp.isPackaged = true;
    mockAutoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('no network'));

    expect(() => initializeAutoUpdater()).not.toThrow();
    // The rejection is handled inside checkForUpdates; let its catch run before asserting.
    await vi.waitFor(() => expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce());
  });
});
