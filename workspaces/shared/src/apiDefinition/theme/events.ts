import { InferEvents } from '../types.js';
import { ThemeStateSchema } from './types.js';

/**
 * Emitted whenever the resolved appearance changes - because the user flipped their OS
 * dark-mode switch, or because something called `theme.setSource`. The payload is the
 * whole new state rather than a "something changed" nudge: unlike a list of notes there
 * is nothing more to fetch, so making the renderer ask again would be a round trip for
 * two fields it was just handed.
 */
export const themeEvents = {
  changed: {
    channel: 'theme.changed' as const,
    payloadSchema: ThemeStateSchema,
  },
} as const;

export type ThemeApiEvents = InferEvents<typeof themeEvents>;
