import { app, BrowserWindow, dialog, session } from 'electron';
import { initializeDatabase } from './database/sqlite.config';
import { registerAllHandlers } from './handlersRegistry';
import { projectPaths } from './config/project';
import { getLogger } from './logger';
import { buildAppMenu } from './menu';
import { startThemeWatcher } from './models/theme/theme.handler';
import { applyProductionCsp, attachNavigationGuards, DEV_SERVER_ORIGIN, RENDERER_INDEX } from './security';
import { initializeAutoUpdater } from './updater';
import { loadWindowState, saveWindowState } from './windowState';

let mainWindow: BrowserWindow | null;

/**
 * A second instance would open a second TypeORM DataSource against the same SQLite file. Rather
 * than risk that, only the first instance runs; any later launch hands its focus request to the
 * running one and exits.
 */
const isPrimaryInstance = app.requestSingleInstanceLock();

function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    // Electron paints a blank window as soon as it's constructed, which reads as a white flash
    // until the renderer has something to draw. Stay hidden until 'ready-to-show'.
    show: false,
    title: app.getName(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: projectPaths.preloadJS, // Use the compiled preload.js
      sandbox: true,
    },
  });

  if (windowState.maximized) {
    mainWindow.maximize();
  }

  // Navigation guards are attached centrally in app.on('web-contents-created'), which also
  // fires for this window's own webContents - doing it here as well would double every listener.

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (app.isPackaged) {
    // The Angular browser build is copied into electron-app/renderer at build time
    // (see scripts/copy-renderer.mjs) so it ships inside the packaged app/asar.
    mainWindow.loadFile(RENDERER_INDEX);
  } else {
    mainWindow.loadURL(DEV_SERVER_ORIGIN);
    mainWindow.webContents.openDevTools();
  }

  const persist = () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  };
  mainWindow.on('resized', persist);
  mainWindow.on('moved', persist);
  mainWindow.on('close', persist);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * A renderer that crashes while loading would otherwise be recreated forever. Allow a few
 * respawns for a genuinely transient crash, then tell the user and stop.
 */
const CRASH_WINDOW_MS = 30_000;
const MAX_CRASHES_IN_WINDOW = 3;
let recentCrashes: number[] = [];

function handleRendererGone(reason: string) {
  getLogger().error('Renderer process gone:', reason);

  const now = Date.now();
  recentCrashes = [...recentCrashes, now].filter((at) => now - at < CRASH_WINDOW_MS);

  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }

  if (recentCrashes.length > MAX_CRASHES_IN_WINDOW) {
    getLogger().error(`Renderer crashed ${recentCrashes.length} times in ${CRASH_WINDOW_MS}ms; giving up`);
    dialog.showErrorBox(
      `${app.getName()} keeps crashing`,
      `The application window crashed repeatedly (${reason}) and will now close.`
    );
    app.exit(1);
    return;
  }

  createWindow();
}

if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    if (app.isPackaged) {
      applyProductionCsp();
    }
    buildAppMenu();
    await initializeDatabase();
    registerAllHandlers();
    // Before the window, so the first renderer paint already has the right appearance.
    startThemeWatcher();
    createWindow();
    // After the window, so a slow or failing update check never delays first paint. It is a
    // no-op in dev and in builds without an update feed - see updater.ts.
    initializeAutoUpdater();
  });

  // Applies the guards to every webContents, not just the main window's - including any that
  // some future feature creates.
  app.on('web-contents-created', (_event, contents) => {
    attachNavigationGuards(contents);
  });

  app.on('window-all-closed', function () {
    session.defaultSession.clearCache().then(() => {
      getLogger().debug('Cache cleared');
    });
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', function () {
    if (mainWindow === null) createWindow();
  });

  app.on('render-process-gone', (_event, _webContents, details) => {
    handleRendererGone(details.reason);
  });
}

let handlingFatalError = false;

process.on('uncaughtException', (error) => {
  getLogger().error('Uncaught exception in main process:', error);
  if (handlingFatalError) {
    // The error handler itself threw - don't loop, just go.
    app.exit(1);
    return;
  }
  handlingFatalError = true;
  // The main process owns the database connection and every IPC handler; once it has thrown
  // past all of them its state is unknown, so continuing to serve the renderer risks acting on
  // (or writing) something inconsistent. Tell the user, then stop.
  dialog.showErrorBox(
    `${app.getName()} encountered an unexpected error`,
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n\nThe application will now close.`
  );
  app.exit(1);
});
