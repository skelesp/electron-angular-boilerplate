import { describe, it, expect, beforeEach, vi } from 'vitest';
import { noteEvents } from '@electron-angular-boilerplate/shared';

// emitAppEvent broadcasts through BrowserWindow, the one part of the event path that needs
// a real Electron API, so this is the spec that mocks `electron`.
const { mockSend, mockWindow, mockBrowserWindow } = vi.hoisted(() => {
  const send = vi.fn();
  const window = { isDestroyed: () => false, webContents: { send } };
  return {
    mockSend: send,
    mockWindow: window,
    mockBrowserWindow: { getAllWindows: vi.fn(() => [window]) },
  };
});

vi.mock('electron', () => ({ BrowserWindow: mockBrowserWindow, app: { isPackaged: false } }));

const { emitAppEvent } = await import('./events');

describe('emitAppEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
  });

  it('sends the payload on the event channel to every open window', () => {
    emitAppEvent(noteEvents.changed.channel, { reason: 'created', id: 'abc' });

    expect(mockSend).toHaveBeenCalledWith(noteEvents.changed.channel, { reason: 'created', id: 'abc' });
  });

  it('skips a window that has already been destroyed', () => {
    mockBrowserWindow.getAllWindows.mockReturnValue([{ isDestroyed: () => true, webContents: { send: mockSend } }]);

    emitAppEvent(noteEvents.changed.channel, { reason: 'deleted', id: 'abc' });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('still delivers, but logs, when a payload violates the event schema in development', () => {
    // Cast because this is precisely the case the types forbid and runtime has to catch.
    emitAppEvent(noteEvents.changed.channel, { reason: 'exploded', id: 'abc' } as never);

    expect(mockSend).toHaveBeenCalledOnce();
  });
});
