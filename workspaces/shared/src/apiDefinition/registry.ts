import * as noteApi from './note/endpoints';
import * as noteEventApi from './note/events';

export * from './note/endpoints';
export * from './note/events';
export * from './note/types';

// Add one entry per domain here. See the "Adding a new API" section in the
// README for the full set of steps (shared -> electron-app -> angular-app).
export const apiRegistry = {
  [noteApi.noteApiName]: noteApi.noteEndpoints,
} as const;

export type AppApiRegistry = noteApi.NoteApiEndpoints;

// The push half of the contract: main-process -> renderer events. Kept in its own
// registry because events have no response and so can't share the endpoint shape, but
// registered and validated exactly the same way. Domains without events simply don't
// appear here.
export const eventRegistry = {
  [noteApi.noteApiName]: noteEventApi.noteEvents,
} as const;

export type AppApiEvents = noteEventApi.NoteApiEvents;
