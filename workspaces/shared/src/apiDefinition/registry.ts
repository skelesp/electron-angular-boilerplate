import * as noteApi from './note/endpoints';

export * from './note/endpoints';
export * from './note/types';

// Add one entry per domain here. See the "Adding a new API" section in the
// README for the full set of steps (shared -> electron-app -> angular-app).
export const apiRegistry = {
  [noteApi.noteApiName]: noteApi.noteEndpoints,
} as const;

export type AppApiRegistry = noteApi.NoteApiEndpoints;
