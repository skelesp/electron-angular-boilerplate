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
consumers should change them. No code-signing is configured. This repo's CI
(`.github/workflows/ci.yml`) only lints/builds/tests, it does not produce installers.

`build.npmRebuild` is `false`, which is deliberate. The only native production dependency is
`better-sqlite3`, and since v13 it is an **N-API** addon shipping prebuilt binaries inside its
own npm tarball (`node_modules/better-sqlite3/prebuilds/<platform>-<arch>.node`, one per
platform rather than one per Node/Electron ABI). N-API is ABI-stable across Electron versions,
so the prebuilt binary already works and a rebuild is pure cost. It is not merely unnecessary
but actively harmful here: `@electron/rebuild` doesn't recognise that flat `prebuilds/` layout,
so left enabled it forces a from-source `node-gyp` build and fails outright on any machine
without a C++ toolchain (on Windows, "Could not find any Visual Studio installation to use").
`asarUnpack` keeps the package outside the asar archive so the `.node` file is a real file on
disk; `sqlite.config.ts` passes no `nativeBinding` path and lets better-sqlite3 resolve its own.
The practical upshot is that installers for every platform can be built from one machine as far
as the database driver is concerned. **If a future `better-sqlite3` major goes back to
per-ABI prebuilds, or a second native dependency is added, this trade-off has to be revisited** —
that's when `npmRebuild` needs turning back on (and with it a toolchain per target platform).

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

**Diagnosing a packaged build without a display**: run
`ELECTRON_RUN_AS_NODE=1 "release/win-unpacked/Electron Angular Boilerplate.exe" <script.js> <path-to-app.asar>/node_modules`
(the asar path must be absolute) — this runs the packaged Electron binary as plain Node (no
window, no signing, no `--dir` rebuild needed), so a script that `require()`s the app's real
dependencies by absolute path reveals every missing module in the actual packaged tree in one
pass instead of iterating crash-by-crash. It is also the fastest way to confirm the database
actually opens under the packaged Electron. `npx asar list release/win-unpacked/resources/app.asar`
is the complementary tool for checking whether a specific package made it into the asar at all.
Set that variable **only as a one-off prefix on the command**, never exported into your shell:
while it is set, every Electron binary launched from that shell runs as plain Node, so the GUI
never starts and `npm run test:e2e` fails with a misleading `Error: Process failed to launch!`
(Playwright's `--remote-debugging-port=0` reaching Node's option parser as `bad option`).
This mattered historically: electron-builder's production-dependency walk (used because
`directories.app`'s own `node_modules` is hoisted away, same root cause as above) used to
silently drop `call-bind-apply-helpers`, `side-channel` and `qs` — real transitive dependencies
of TypeORM 0.3's `sha.js` hashing path — and `build.files` carried three explicit `{from, to}`
entries to copy them in by hand. TypeORM 1.x dropped `sha.js`, those packages left the
production graph entirely, and the entries were removed. **If a future dependency bump hits the
same class of bug**, the recipe above is how to find it.

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
test` — it's slow (a full build + packaging) and platform-specific.

A root `.npmrc` sets `legacy-peer-deps=true` — without it, `npm install` reproducibly crashes
(`Cannot read properties of null (reading 'edgesOut')`) while recursing into `vitest`'s own peer
dependency set, an npm/Arborist bug rather than anything specific to this repo. It is reached
via `@angular/build`'s _optional_ `vitest: ^4.0.8` peer: this repo is on vitest 5, so Arborist
resolves the unsatisfied peer, fetches vitest 4's manifest and dies walking it. Note it only
reproduces on a **clean** install (no `node_modules`, no lockfile) — an incremental install over
an existing tree gets far enough not to hit it, so don't conclude it's fixed from one `npm
install`. Removable once npm ships a fix or `@angular/build` widens that peer to vitest 5; if
`npm install` starts crashing that way again after removing it, that's why.

## Dependencies

Staying current is most of a boilerplate's value, so `.github/dependabot.yml` runs Dependabot
weekly over the npm workspaces (one `directory: /` entry covers every workspace manifest — it
reads the root `package.json`'s `workspaces` field) and over the GitHub Actions in CI.
Dependabot rather than Renovate specifically because this is a GitHub _template_: it needs no
app install, so it works on a consumer's fork the moment they click "Use this template".
Angular, the lint/format toolchain and the test toolchain are each grouped into a single PR —
they only resolve against each other, so per-package PRs would just fail. `electron` and
`better-sqlite3` majors are ignored: both move native/ABI ground that CI does not cover (CI
builds no installers), so they're taken deliberately, by hand, with a real `npm run package`.

Two version choices deviate from what a resolver would pick on its own, both on purpose:

- `better-sqlite3` is on **13.x** while TypeORM 1.1.1 declares a `^12.0.0` optional peer. v13 is
  the release that moved to N-API with in-tarball prebuilds, which is the entire reason the
  packaging story works without a toolchain (see "Packaging"); v12 is NAN-based with per-ABI
  prebuilds published only up to Electron ABI 148, and Electron 44 is ABI 149 — so on v12 there
  is no usable prebuilt binary at all. TypeORM's driver only touches better-sqlite3's stable
  `Database` surface (`new Database(path, opts)`, `.pragma`, `.prepare`, `.exec`, `.close`), and
  passes `nativeBinding: null` through, which v13 accepts. `legacy-peer-deps` covers the range
  mismatch. Drop this note once TypeORM widens the peer.
- `vitest` is on **5.x** while `@angular/build` declares an optional `^4.0.8` peer. The
  `@angular/build:unit-test` builder runs fine on vitest 5 (all three workspaces' suites pass);
  the peer range simply hasn't been widened upstream. This is what makes the `.npmrc` workaround
  above still necessary — see "Testing".

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
