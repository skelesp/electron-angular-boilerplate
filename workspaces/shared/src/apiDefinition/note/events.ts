import { z } from 'zod';
import { InferEvents } from '../types.js';

/**
 * Emitted by the main process whenever the stored set of notes changes, so the renderer
 * doesn't have to guess when its cached list went stale. It carries only what changed,
 * not the new list - a renderer that cares re-reads through the request/response API,
 * which keeps a single code path for "how do I get notes".
 */
export const NoteChangedPayloadSchema = z.strictObject({
  reason: z.enum(['created', 'updated', 'deleted']),
  id: z.string(),
});
export type NoteChangedPayload = z.infer<typeof NoteChangedPayloadSchema>;

export const noteEvents = {
  changed: {
    channel: 'note.changed' as const,
    payloadSchema: NoteChangedPayloadSchema,
  },
} as const;

export type NoteApiEvents = InferEvents<typeof noteEvents>;
