import { BrowserWindow } from 'electron';
import { AppApiEvents, getEventSchema } from '@electron-angular-boilerplate/shared';
import { isDevBuild } from './env';
import { getLogger } from './logger';

/**
 * Push a typed event to every open renderer.
 *
 * This is the counterpart to `wrapHandler`: the same contract, applied to the direction
 * the renderer can't initiate. The channel and payload type both come from
 * `AppApiEvents`, so an unregistered channel or a payload of the wrong shape is a compile
 * error, and the payload is parsed against the channel's zod schema in development builds
 * for the same reason responses are - a contract that only holds at compile time doesn't
 * hold at all once anything crosses a process boundary.
 *
 * Broadcasting to all windows (rather than taking a `WebContents`) is the right default
 * for "this application state changed": every window showing that state wants to know.
 * A per-window event - progress for a job one window started - should take its target
 * explicitly instead.
 */
export function emitAppEvent<TChannel extends keyof AppApiEvents>(
  channel: TChannel,
  payload: AppApiEvents[TChannel]
): void {
  if (isDevBuild()) {
    const schema = getEventSchema(channel);
    if (!schema) {
      getLogger().error(`No schema registered for event channel ${channel}`);
    } else {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        getLogger().error(`Event payload for ${channel} does not match its schema:`, parsed.error.message);
      }
    }
  }

  // `BrowserWindow` is undefined outside a real Electron process (unit tests), and a
  // window can be destroyed between the lookup and the send.
  const windows = BrowserWindow?.getAllWindows?.() ?? [];
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}
