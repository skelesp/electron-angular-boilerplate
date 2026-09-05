import * as noteApi from './note/endpoints';
import * as noteEventApi from './note/events';
import * as themeApi from './theme/endpoints';
import * as themeEventApi from './theme/events';

export * from './note/endpoints';
export * from './note/events';
export * from './note/types';
export * from './theme/endpoints';
export * from './theme/events';
export * from './theme/types';

// Add one entry per domain here. See the "Adding a new API" section in the
// README for the full set of steps (shared -> electron-app -> angular-app).
export const apiRegistry = {
  [noteApi.noteApiName]: noteApi.noteEndpoints,
  [themeApi.themeApiName]: themeApi.themeEndpoints,
} as const;

// An intersection, not a union: each domain contributes its own channel keys to one
// channel -> endpoint map, and a channel belonging to two domains at once would be a name
// collision rather than a choice between them.
export type AppApiRegistry = noteApi.NoteApiEndpoints & themeApi.ThemeApiEndpoints;

// The push half of the contract: main-process -> renderer events. Kept in its own
// registry because events have no response and so can't share the endpoint shape, but
// registered and validated exactly the same way. Domains without events simply don't
// appear here.
export const eventRegistry = {
  [noteApi.noteApiName]: noteEventApi.noteEvents,
  [themeApi.themeApiName]: themeEventApi.themeEvents,
} as const;

export type AppApiEvents = noteEventApi.NoteApiEvents & themeEventApi.ThemeApiEvents;
