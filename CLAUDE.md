# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A template repo (npm workspaces monorepo) for a desktop app: Angular frontend (renderer),
Electron main process, a SQLite database via TypeORM, and a **shared, runtime-validated API
contract** between the two — zod schemas in `shared` are the single source of truth for both
the TypeScript types and the IPC input validation. Because this is a GitHub template, treat
the boilerplate's own conventions (not any single feature) as the thing to keep consistent.

## Commands

Run from the repo root unless noted.

```
npm install
npm start                      # build:shared, then run watch:shared + Angular dev server + Electron concurrently
```

- `npm run build` — builds `shared`, then `electron-app`, then `angular-app`, in that order (each depends on the previous).
- `npm run build:shared` / `build:electron-app` / `build:angular-app` — build one workspace.
- `npm run lint` / `npm run lint:fix` — runs across all workspaces (`npm run lint --workspaces --if-present`).
- `npm run format` / `npm run format:check` — Prettier over the whole repo.
- `npm run test` — runs `test` in every workspace that has one. Currently only `angular-app` has tests (Karma/Jasmine).
  - Single workspace: `npm --workspace=workspaces/angular-app run test`.
  - `ng test` has no built-in "single spec file" flag in this setup; narrow with Jasmine's `fdescribe`/`fit` in the spec instead.
- `npm run clean` — cleans build output in every workspace.

Per-workspace scripts (run with `npm --workspace=workspaces/<name> run <script>`):

- `shared`: `dev` (`tsc --watch`), `compile`/`build`/`build:prod` (`tsc --build`), `watch`.
- `electron-app`: `start` (`tsc && electron .`) — expects Angular already serving at `localhost:4200`.
- `angular-app`: `start` (`ng serve`), `watch` (`ng build --watch`).

VS Code: the `Electron+Angular debug` launch compound (`.vscode/launch.json`) runs the
`Build.All` task, then attaches to both the Electron main process and the Chrome renderer at
`localhost:4200` on port 9224.

`shared` and `electron-app` use TypeScript project references (`tsc --build`) with
`composite: true`; `angular-app` also references `shared`. If cross-workspace types look
stale, rebuild `shared` first — everything else imports from `@electron-angular-boilerplate/shared`'s
compiled `dist`, not its source.

## Architecture: the shared API contract

This is the core pattern of the boilerplate and spans all three workspaces. To modify or add
API surface, changes touch files in this order:

1. **`shared/src/apiDefinition/<domain>/types.ts`** — zod schemas for one domain's input/output
   (TS types are inferred from these, not written separately).
2. **`shared/src/apiDefinition/<domain>/endpoints.ts`** — maps each action to an IPC channel
   name plus its input/output schemas.
3. **`shared/src/apiDefinition/registry.ts`** — combines every domain into `apiRegistry`
   (runtime object) and `AppApiRegistry` (compile-time type). Every domain must be added here.
4. **`electron-app/src/models/<domain>/`** — TypeORM entity + repository, plus a
   `<domain>.handler.ts` with one handler per endpoint. Handlers just implement logic and throw
   on error; they do not do their own input validation or response wrapping.
5. **`electron-app/src/database/sqlite.config.ts`** — new entities must be added to the
   `entities` array here (TypeORM `synchronize: true`, so the SQLite schema auto-syncs to
   entities — no migrations).
6. **`electron-app/src/handlersRegistry.ts`** — spread the new domain's handlers object into
   `handlersRegistry`. `wrapHandler` (in this file) validates every raw IPC payload against the
   channel's zod input schema before the handler runs, and normalizes both success and thrown
   errors into an `ApiResponse<T>` envelope (`{status: 'success', data} | {status: 'error', error}`).
   This is the one place that behavior lives — don't duplicate it in individual handlers.
7. **`angular-app/src/services/<domain>.service.ts`** — calls `ElectronService.invoke(channel, data)`,
   which is typed against `AppApiRegistry` end to end, so a wrong channel name or payload shape
   is a compile error in Angular, not a runtime failure.

The `note` domain (create/get/list/delete) is a complete reference implementation of this
pattern across all three workspaces (`shared/src/apiDefinition/note/`,
`electron-app/src/models/notes/`, `angular-app/src/services/note.service.ts`, exercised by
`ApiTesterComponent`). Follow its shape for new domains rather than reinventing it.

Renderer-side IPC access is intentionally narrow: `electron-app/src/preload.ts` exposes a
single typed `electronAPI.invoke(channel, data)` via `contextBridge` (validated against
`isValidChannel` from `shared`), and `angular-app/src/services/electron.service.ts` is the only
place that touches `window.electronAPI`. Individual Angular services should go through
`ElectronService`, not `window.electronAPI` directly.

## Notes

- `contextIsolation: true` / `nodeIntegration: false` in `electron-app/src/main.ts`, but
  `sandbox: false` — the code comments explain this is intentionally insecure for the
  boilerplate/dev setup; don't quietly "fix" it without flagging the tradeoff.
- Electron's main process loads `http://localhost:4200` unconditionally (not a packaged
  `file://` build) — this repo is set up for dev/debug, not production packaging.
- The SQLite file lives at `data/boilerplate.sqlite`, referenced relative to the compiled
  `electron-app/dist/main.js`.
