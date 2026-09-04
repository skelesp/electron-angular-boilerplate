import { app, Menu, MenuItemConstructorOptions } from 'electron';

/**
 * Without an explicit menu, a packaged build ships Electron's default one - which includes
 * Reload, Force Reload and Toggle DevTools. Those are development affordances, not app
 * features. This template installs a menu that keeps the standard platform roles users expect
 * (clipboard, zoom, window management) and only adds the developer items when not packaged.
 *
 * Consumers of the boilerplate are expected to replace this with their own app's menu.
 */
export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const developerItems: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? ([{ role: 'appMenu' }] as MenuItemConstructorOptions[]) : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: '&View',
      submenu: [
        ...developerItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
