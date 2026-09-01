import { app, BrowserWindow, screen, session } from 'electron';
import { initializeDatabase } from './database/sqlite.config';
import { registerAllHandlers } from './handlersRegistry';
import { projectPaths } from './config/project';

let mainWindow: BrowserWindow | null;

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
      sandbox: false, // Not secure! https://www.electronjs.org/docs/latest/tutorial/esm && https://www.electronjs.org/docs/latest/breaking-changes#default-changed-renderers-without-nodeintegration-true-are-sandboxed-by-default
    },
  });

  //app.isPackaged ? `file://${path.join(__dirname, '../angular-app/dist/angular-app/index.html')}` : `http://localhost:4200`;
  const startURL = `http://localhost:4200`;
  mainWindow.loadURL(startURL);

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
  await initializeDatabase();
  registerAllHandlers();
  createWindow();
});

app.on('window-all-closed', function () {
  session.defaultSession.clearCache().then(() => {
    console.log('Cache cleared');
  });
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
