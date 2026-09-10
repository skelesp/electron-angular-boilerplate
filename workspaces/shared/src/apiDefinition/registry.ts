import * as noteApi from './note/endpoints.js';
import * as noteEventApi from './note/events.js';
import * as themeApi from './theme/endpoints.js';
import * as themeEventApi from './theme/events.js';

export * from './note/endpoints.js';
export * from './note/events.js';
export * from './note/types.js';
export * from './theme/endpoints.js';
export * from './theme/events.js';
export * from './theme/types.js';

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
