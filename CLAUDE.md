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
- `npm run test` — runs `shared`, `electron-app`, and `angular-app`'s Vitest suites (explicitly
  scoped, not `--workspaces`, so it doesn't also try to run `e2e`'s Playwright suite — see
  "Testing" below). Single workspace: `npm --workspace=workspaces/<name> run test`.
  - Vitest has no built-in "single spec file" CLI narrowing in this setup; use `.only`/`.skip`
    on a `describe`/`it` in the spec instead, or pass a filename to `vitest run <pattern>`.
- `npm run test:e2e` — packages the app (`electron-builder --dir`) and runs the Playwright suite
  in `workspaces/e2e` against it. Not part of `npm run test` or CI — see "Testing" below.
- `npm run clean` — cleans build output in every workspace.
- `npm run package` — builds everything and runs `electron-builder` (via its `prepackage`/
  `postpackage` hooks) to produce an installer/unpacked app under `/release`. See "Packaging" below.

Per-workspace scripts (run with `npm --workspace=workspaces/<name> run <script>`):

- `shared`: `dev` (`tsc --watch`), `compile`/`build`/`build:prod` (`tsc --build`), `watch`.
- `electron-app`: `start` (`tsc && electron .`) — expects Angular already serving at `localhost:4200`;
  `migration:generate` / `migration:run` / `migration:revert` for TypeORM migrations.
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
   `entities` array here. `synchronize` is only on in dev (auto-syncs schema to entities);
   packaged builds run TypeORM migrations instead (`migrationsRun: true`) — after changing an
   entity, generate a migration with `npm --workspace=workspaces/electron-app run migration:generate`
   (uses the standalone CLI data source at `electron-app/src/database/data-source.cli.ts`) and
   commit it alongside the entity change.
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

## Packaging

`npm run package` (root) runs `electron-builder` (config in the root `package.json`'s `build`
field, `directories.app` pointed at `workspaces/electron-app`) to produce an installer/unpacked
app under `/release`. `appId`/`productName` in that config are placeholders — template
consumers should change them. No code-signing is configured. `sqlite3`'s native binding is
rebuilt per-target by electron-builder (`npmRebuild`, on by default) and is ABI-specific per
OS/arch, so installers must be built on (or cross-rebuilt for) each target platform — this
repo's CI (`.github/workflows/ci.yml`) only lints/builds/tests, it does not produce installers.

Two npm-workspaces-specific gotchas that the `prepackage`/`postpackage` hooks (auto-run by npm
around `npm run package`) exist to work around — don't remove them without re-verifying a real
`npm run package` run:

- `prepackage` builds everything, copies the Angular browser build into `electron-app/renderer/`
  (`copy-renderer.mjs`), and creates an empty `electron-app/node_modules/` if missing
  (`ensure-node-modules-stub.mjs`) — electron-builder treats a _missing_ `node_modules` in
  `directories.app` as "dependencies were never installed" and responds by running
  `npm install --production` scoped to that directory, which in this hoisted monorepo prunes
  the repo's _root_ devDependencies (electron-builder included) instead of doing anything useful.
  An empty stub directory is enough to make it skip straight to rebuilding native modules instead.
- `prepackage` also vendors a real (non-symlink) copy of the compiled `shared` package into
  `electron-app/node_modules/@electron-angular-boilerplate/shared` (`vendor-shared.mjs`);
  `postpackage` removes it again. `@electron-angular-boilerplate/shared` is normally an npm
  workspace symlink pointing at `workspaces/shared`, and electron-builder's asar packer resolves
  symlinks to their real path and throws if that path isn't under `directories.app` — vendoring
  a real local copy makes Node's (and electron-builder's) module resolution find it first and
  never walk out to the symlink. It's added/removed only around packaging, specifically so a
  normal `npm start` dev session keeps resolving the _live_ symlinked `shared` package (needed
  for `npm run watch:shared` hot-updates) instead of a stale packaging-time snapshot.
- `build.files` in the root `package.json` also has three explicit `{from, to}` entries copying
  `call-bind-apply-helpers`, `side-channel`, and `qs` from the hoisted root `node_modules` into
  the packaged `node_modules`. electron-builder's automatic production-dependency walk (used
  because `directories.app`'s own `node_modules` is hoisted away, same root cause as above)
  silently drops these three real, non-optional, non-workspace transitive dependencies of
  `typeorm`'s `sha.js`-based hashing path — apparently a dedup bug where it conflates them with
  a same-named but differently-located nested copy elsewhere in the tree — even though it
  correctly includes everything else in that same require chain (`get-intrinsic`, `dunder-proto`,
  `call-bound`, etc.). Without this, the packaged app throws `Cannot find module
'call-bind-apply-helpers'` the moment anything touches the database. **If a future dependency
  bump hits the same class of bug**, diagnose it without needing a display: run
  `ELECTRON_RUN_AS_NODE=1 "release/win-unpacked/Electron Angular Boilerplate.exe" <script.js> <path-to-app.asar>/node_modules`
  — this runs the packaged Electron binary as plain Node (no window, no signing, no `--dir`
  rebuild needed), so a script that `require()`s the app's real dependencies by absolute path
  reveals every missing module in the actual packaged tree in one pass instead of iterating
  crash-by-crash. `npx asar list release/win-unpacked/resources/app.asar` is the complementary
  tool for checking whether a specific package made it into the asar at all.

In dev, Electron always loads `http://localhost:4200`; in a packaged build (`app.isPackaged`)
it loads the bundled `renderer/index.html` instead, and a CSP is applied via
`session.defaultSession.webRequest.onHeadersReceived` (dev is intentionally left unrestricted
so `ng serve`/live-reload keeps working).

## Testing

All three main workspaces use **Vitest** — `shared` and `electron-app` directly (each owns its
own `vitest` devDependency and a minimal `vitest.config.ts`), `angular-app` via Angular's
`@angular/build:unit-test` builder (`angular.json`'s `test` target), whose `runner` option
defaults to `"vitest"` and runs in jsdom — no real browser, so CI doesn't need Chrome installed.
That builder is marked `[EXPERIMENTAL]` by Angular itself. Spec files use the `.spec.ts` suffix
and explicit `import { describe, it, expect, vi } from 'vitest'` (no globals mode) everywhere,
including in `angular-app`.

`electron-app`'s code can't just be imported into a test file as-is:
`database/sqlite.config.ts` and `logger.ts` both read `app` from `electron` at **module load
time** (not inside a function), which crashes outside a real Electron process — `electron`
resolves to a stub with no real `app`/`ipcMain` under plain Node/Vitest. Any spec that imports
`handlersRegistry.ts` or a domain's `*.handler.ts` — directly or transitively — needs
`vi.mock('electron', ...)` and/or `vi.mock('../../database/sqlite.config', ...)` (swapping in a
real in-memory `DataSource`, e.g. `src/test-utils/sqliteTestDataSource.ts`) before importing it.
Because `vi.mock`/`vi.hoisted` are hoisted above this file's own top-level imports, building an
async dependency (like an initialized `DataSource`) for a mock factory to use has to happen
inside `vi.hoisted(async () => {...})`'s own dynamic `import()`s, not via regular imports — see
`handlersRegistry.spec.ts` and `models/notes/note.handler.spec.ts` for the pattern. This is not
something to refactor away; it's inherent to `sqlite.config.ts`'s module-level `app.isPackaged`
check (see "Packaging" above) and just needs mocking around in tests.

ESLint's `parserOptions.projectService` needs every linted file to belong to some tsconfig's
`"include"`. Spec files, `src/test-utils/**`, and each workspace's `vitest.config.ts` are
excluded from the main `tsconfig.json` (so `tsc --build` never emits them to `dist/`) — they're
linted instead via `projectService.allowDefaultProject`, an explicit file list in each
`eslint.config.mjs` (globstar patterns are disallowed there, to stop a typo from silently
degrading a whole tree to the slower single-file lint mode) — **add new spec files to that list
too**, or they'll fail lint with "not found by the project service".

`workspaces/e2e` is a separate Playwright suite (`@playwright/test`, using its `_electron`
launcher) that runs against the **packaged** app, not `localhost:4200` — deliberately, since
things like a sandboxed preload script failing to resolve a dependency or a CSP blocking
something only happen once `app.isPackaged` is true, which a dev-mode test wouldn't catch. Run
it with `npm run test:e2e` from root (packages with `electron-builder --dir` first, since that's
much faster than a full installer build). It's intentionally not wired into CI or `npm run
test` — it's slow (native module rebuild + packaging) and platform-specific.

A root `.npmrc` sets `legacy-peer-deps=true` — without it, `npm install` reproducibly crashes
(`Cannot read properties of null (reading 'edgesOut')`) while resolving `vitest`'s own peer
dependency graph, an npm/Arborist bug rather than anything specific to this repo. Safe to
remove once npm ships a fix; if `npm install` starts failing that way again after removing it,
that's why.

## Notes

- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` in
  `electron-app/src/main.ts` — the standard secure Electron `webPreferences` combination.
  `preload.ts` only uses `contextBridge`/`ipcRenderer` plus pure-TS validation from `shared`,
  which all work under a sandboxed preload; keep it that way (no `fs`/other Node built-ins in
  preload or in anything `shared` exports) if you don't want to revisit this.
- The SQLite file path is resolved relative to `__dirname` (not `process.cwd()`), so it works
  regardless of the process's working directory: dev uses `electron-app/data/boilerplate.sqlite`,
  packaged builds use `app.getPath('userData')`. See `electron-app/src/database/sqlite.config.ts`.
- Logging goes through `electron-app/src/logger.ts` (`electron-log`, level gated by
  `app.isPackaged`) rather than raw `console.*` in the main process.
