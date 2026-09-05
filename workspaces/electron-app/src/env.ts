import { app } from 'electron';

/**
 * `app.isPackaged` is the flag that separates "a developer is running this from source"
 * from "a user installed this", and several modules need it. Reading it through a
 * function rather than at module load time is what keeps those modules importable
 * outside a real Electron process - under plain Node (Vitest, the TypeORM CLI) the
 * `electron` package resolves to a path string, so `app` is `undefined` and touching
 * `app.isPackaged` at import time throws before a test can mock anything.
 *
 * Treating "no Electron at all" as a development build is the safe default: it only ever
 * turns on extra checking (verbose logging, output validation), never off.
 */
export function isPackagedBuild(): boolean {
  return app?.isPackaged ?? false;
}

export function isDevBuild(): boolean {
  return !isPackagedBuild();
}
