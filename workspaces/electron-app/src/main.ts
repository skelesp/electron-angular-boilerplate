import { app, BrowserWindow, screen, session } from 'electron';
import { join } from 'path';
import { initializeDatabase } from './database/sqlite.config';
import { registerAllHandlers } from './handlersRegistry';
import { projectPaths } from './config/project';
import { logger } from './logger';

let mainWindow: BrowserWindow | null;

function applyProductionCsp() {
  // Only enforced when packaged, so the Angular dev server / live-reload isn't broken in dev.
  // 'unsafe-inline' on style-src is required because Angular's view encapsulation and Angular
  // Material inject inline <style> tags at runtime - an accepted trade-off, not an oversight.
  // 'unsafe-inline' on script-src-attr (not script-src, which stays free of it) is required
  // because Angular's production build emits an inline onload="" attribute on its stylesheet
  // <link> (a critical-CSS preload swap) - script-src-attr only permits inline event-handler
  // attributes like that one, not inline <script> blocks or javascript: URLs.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; script-src-attr 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';",
        ],
      },
    });
  });
}

function createWindow() {
  // Select the second display if available, otherwise default to the primary display
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.length > 1 ? displays[1] : displays[0];

  mainWindow = new BrowserWindow({
    width: 958,
    height: 1200,
    x: externalDisplay.bounds.x, // Set window X position to the second screen
    y: externalDisplay.bounds.y, // Set window Y position to the second screen
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: projectPaths.preloadJS, // Use the compiled preload.js
      sandbox: true,
    },
  });

  if (app.isPackaged) {
    // The Angular browser build is copied into electron-app/renderer at build time
    // (see scripts/copy-renderer.mjs) so it ships inside the packaged app/asar.
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:4200');
  }

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      const url = mainWindow.webContents.getURL();
      mainWindow.setTitle(`Electron - ${url}`);
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    applyProductionCsp();
  }
  await initializeDatabase();
  registerAllHandlers();
  createWindow();
});

app.on('window-all-closed', function () {
  session.defaultSession.clearCache().then(() => {
    logger.debug('Cache cleared');
  });
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

app.on('render-process-gone', (_event, _webContents, details) => {
  logger.error('Renderer process gone:', details.reason);
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  createWindow();
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process:', error);
});
