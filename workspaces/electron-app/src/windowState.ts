import { app, screen, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getLogger } from './logger';

/**
 * Persisted window geometry, so the app reopens where the user last left it instead of on a
 * hardcoded display. Stored next to the database in `app.getPath('userData')`, which is
 * per-user and survives reinstalls.
 */
export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1280,
  height: 800,
  maximized: false,
};

function stateFilePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

/**
 * A saved position is only usable if it still lands on a connected display - otherwise an
 * unplugged monitor (or a resolution change) would put the window somewhere invisible.
 */
function isVisibleOnSomeDisplay(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) {
    return false;
  }
  const bounds = { x: state.x, y: state.y, width: state.width, height: state.height };
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

export function loadWindowState(): WindowState {
  let stored: Partial<WindowState>;
  try {
    stored = JSON.parse(readFileSync(stateFilePath(), 'utf-8')) as Partial<WindowState>;
  } catch {
    // No state yet (first run) or an unreadable/corrupt file - fall back to the defaults.
    return centerOnPrimaryDisplay(DEFAULT_STATE);
  }

  const state: WindowState = {
    width: typeof stored.width === 'number' ? stored.width : DEFAULT_STATE.width,
    height: typeof stored.height === 'number' ? stored.height : DEFAULT_STATE.height,
    x: typeof stored.x === 'number' ? stored.x : undefined,
    y: typeof stored.y === 'number' ? stored.y : undefined,
    maximized: stored.maximized === true,
  };

  return isVisibleOnSomeDisplay(state) ? state : centerOnPrimaryDisplay(state);
}

/**
 * The primary display is the right default for a template: it's the one the user's OS considers
 * "the" screen. Anything else (such as always picking a second monitor) is a personal setup
 * choice that consumers of this boilerplate shouldn't inherit.
 */
function centerOnPrimaryDisplay(state: WindowState): WindowState {
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(state.width, area.width);
  const height = Math.min(state.height, area.height);
  return {
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    maximized: state.maximized,
  };
}

export function saveWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }
  // getNormalBounds() is the un-maximized geometry, so restoring a maximized window still knows
  // what size to return to when the user un-maximizes it.
  const bounds = window.getNormalBounds();
  const state: WindowState = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    maximized: window.isMaximized(),
  };
  try {
    writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    getLogger().warn('Could not persist window state:', error);
  }
}
