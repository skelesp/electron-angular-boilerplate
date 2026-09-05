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
- `npm run test:coverage` — the same three suites with coverage on, writing `lcov.info`,
  `coverage-summary.json` and a terminal summary into each workspace's `coverage/`.
- `npm run coverage:summary` — renders those per-workspace totals as a markdown table (and
  appends it to `$GITHUB_STEP_SUMMARY` under Actions). See "Release engineering" below.
- `npm run package:dir` — `electron-builder --dir --publish never`: the packaged app tree
  without an installer. Much faster than a full build and what the e2e suite runs against.
- `npm run test:e2e` — runs `package:dir`, then the Playwright suite in `workspaces/e2e`
  against the result. Not part of `npm run test`, but it _does_ run in CI on all three
  platforms — see "Testing" and "Release engineering" below.
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
   (TS types are inferred from these, not written separately). Output DTO schemas are
   `z.strictObject`s on purpose — see "Outputs are validated too" below.
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
   channel's zod input schema before the handler runs, validates the response against the
   channel's output schema on the way back out (in dev), and normalizes both success and thrown
   errors into an `ApiResponse<T>` envelope (`{status: 'success', data} | {status: 'error', error}`).
   This is the one place that behavior lives — don't duplicate it in individual handlers.
7. **`angular-app/src/services/<domain>.service.ts`** — calls `ElectronService.invoke(channel, data)`,
   which is typed against `AppApiRegistry` end to end, so a wrong channel name or payload shape
   is a compile error in Angular, not a runtime failure.

### Outputs are validated too

`EndpointDefinition.outputSchema` is not decoration. `wrapHandler` parses every response
against it — but **only when `!app.isPackaged`**. Responses are already type-checked at
compile time, so this catches what types can't (an entity returned where a DTO was declared,
a `Date` that became a string, a handler that drifted from its schema); those are bugs to fix
before shipping, not conditions worth re-checking on every IPC call a user makes. A response
that fails is logged and replaced with an `ApiErrorCode.CONTRACT_VIOLATION` envelope. The
valid response is returned **by identity, not as `parsed.data`** — zod hands back a copy, and
a validator that quietly rewrites what it validates would make dev and production disagree in
exactly the situation where that hurts most.

Output DTO schemas and the `ApiResponse` envelope are `z.strictObject`s for this to be worth
anything: a plain `z.object` accepts (and silently strips) unknown keys, which is exactly the
failure mode being guarded against — a new `@Column()` on an entity riding along to the
renderer.

### Errors carry codes, not HTTP numbers

`ApiErrorCode` (`shared/src/apiDefinition/errors.ts`) is a closed set of named codes —
`VALIDATION_FAILED`, `UNKNOWN_CHANNEL`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`,
`CONTRACT_VIOLATION`, `INTERNAL`. IPC is not HTTP: there is no network, cache or proxy for a
numeric status to mean anything to, and a renderer discriminating on `500` reads worse than one
discriminating on `INTERNAL`. Both the zod schema and the TS union derive from that one object,
so adding a code is a single edit.

A handler chooses its code by throwing `ApiError` (`new ApiError(ApiErrorCode.NOT_FOUND, 'Note
not found')`); `wrapHandler` passes that code through and logs it at debug, since a documented
outcome isn't a failure. Anything else thrown is a bug: it becomes `INTERNAL` and is logged as
an error. The thrown `message` crosses the IPC boundary as `error.details`, so keep it free of
anything you wouldn't show a user.

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
consumers should change them. No code-signing is configured (see "Auto-update" below for
what that costs you). CI packages the app with `--dir` on all three platforms on every PR;
full installers are built only by the release workflow, on a tag.

Three details in the `build` config exist for the release/auto-update path specifically:

- **`publish: [{ provider: "github" }]` with no `owner`/`repo`.** electron-builder fills those
  in from the git remote at build time, so a fork built by its own Actions publishes to _its_
  releases, not to this repo's. That is also why there is deliberately no `repository` field in
  any `package.json` here — it would take precedence and point every fork back at the
  original. The config's real job is to make electron-builder emit the `latest*.yml` update
  metadata and the packaged `app-update.yml`; it does not by itself publish anything.
- **The app version comes from `workspaces/electron-app/package.json`**, because that is what
  `directories.app` points at — _not_ from the root `package.json` (which stays at `0.0.0`).
  electron-builder also derives the release tag it uploads into as `v${version}`. The release
  workflow therefore writes the git tag into that file before building; see below.
- **`mac.target` includes `zip` alongside `dmg`.** Squirrel.Mac updates from a zip, so a
  dmg-only macOS release builds fine and then silently never updates.

Note that `--dir` builds produce **no** `latest*.yml` and no `app-update.yml`: electron-builder
only writes update metadata for real installer targets. That is expected, and `updater.ts`
detects it rather than erroring — see "Auto-update".

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
so `ng serve`/live-reload keeps working). Both live in `electron-app/src/security.ts`, which
also owns the navigation guards — see "Main-process lifecycle" below.

## Testing

All three main workspaces use **Vitest** — `shared` and `electron-app` directly (each owns its
own `vitest` devDependency and a minimal `vitest.config.ts`), `angular-app` via Angular's
`@angular/build:unit-test` builder (`angular.json`'s `test` target), whose `runner` option
defaults to `"vitest"` and runs in jsdom — no real browser, so CI doesn't need Chrome installed.
That builder is marked `[EXPERIMENTAL]` by Angular itself. Spec files use the `.spec.ts` suffix
and explicit `import { describe, it, expect, vi } from 'vitest'` (no globals mode) everywhere,
including in `angular-app`.

### Nothing in `electron-app` touches Electron at import time — keep it that way

`electron-app`'s modules are plain-Node-importable, and a fair amount of design goes into
keeping them that way. Under Vitest the `electron` package resolves to a path string, so `app`
and `ipcMain` are `undefined`; anything that reads `app.isPackaged` or opens a database **at
module load** therefore crashes on import, before a spec can mock anything.

The rule is: read Electron's globals inside functions, never at module scope.

- `env.ts` owns the one `app?.isPackaged` read (`isPackagedBuild()` / `isDevBuild()`), treating
  "no Electron at all" as a development build — a default that only ever turns extra checking
  on, never off.
- `logger.ts` exports `getLogger()`, which configures the transports on first call rather than
  at import.
- `database/sqlite.config.ts` exports `getDataSource()`, which builds the DataSource on first
  call, plus `setDataSource()` / `resetDataSource()` for tests.
- Handlers resolve their repository per request (`new NoteRepository(getDataSource())` behind a
  getter), not in a constructor — `noteHandlers` is built at module load, so a constructor that
  reached for the DataSource would put a live database back on the import path.

The payoff is what a handler spec now looks like: `await useTestDataSource()` in a `beforeAll`,
its `teardown` in the matching `afterAll`, and a normal top-level `import` of the handler. No
`vi.mock`, no `vi.hoisted`, no `vi.hoisted(async () => …)` dance to build an initialized
`DataSource` a mock factory can close over. See `models/notes/note.handler.spec.ts` and
`handlersRegistry.spec.ts`. **If a new domain's spec needs mocking ceremony to import, that's
the signal something went back to doing work at module load** — fix the module, not the spec.

`vi.mock('electron', …)` is still the right tool for the two things that genuinely need a real
Electron API rather than merely importing one: `events.spec.ts` (which needs a fake
`BrowserWindow` to observe the broadcast) and `updater.spec.ts`.

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
it with `npm run test:e2e` from root (packages with `--dir` first, since that's much faster
than a full installer build). It is deliberately **not** part of `npm run test` — it needs a
full build plus packaging, which is far too slow for the inner loop — but it **does** run in
CI, on Windows, macOS and Linux, as the second half of the `package` job. That job is the
only thing in this repo that exercises the packaging landmines in "Packaging" above, so
treat a failure there as a real bug rather than CI flake. See "Release engineering" below.

Coverage is off by default and enabled by `npm run test:coverage`, which each workspace
implements with its own runner: `@vitest/coverage-v8` for `shared` and `electron-app`
(configured in their `vitest.config.ts`), and the `coverageReporters` option on the
`@angular/build:unit-test` target in `angular.json` for `angular-app`. All three emit
`lcov.info` plus `coverage-summary.json`; note that Angular's builder nests its output one
level deeper (`coverage/<project>/`) than vitest's, which `scripts/coverage-summary.mjs`
handles by looking in both places. There are no coverage thresholds — a template that failed
a consumer's build for uncovering its own example code would just get deleted. Add them via
`coverage.thresholds` (vitest) / `coverageThresholds` (Angular) once you have real code.

A root `.npmrc` sets `legacy-peer-deps=true` — without it, `npm install` reproducibly crashes
(`Cannot read properties of null (reading 'edgesOut')`) while recursing into `vitest`'s own peer
dependency set, an npm/Arborist bug rather than anything specific to this repo. It is reached
via `@angular/build`'s _optional_ `vitest: ^4.0.8` peer: this repo is on vitest 5, so Arborist
resolves the unsatisfied peer, fetches vitest 4's manifest and dies walking it. Note it only
reproduces on a **clean** install (no `node_modules`, no lockfile) — an incremental install over
an existing tree gets far enough not to hit it, so don't conclude it's fixed from one `npm
install`. Removable once npm ships a fix or `@angular/build` widens that peer to vitest 5; if
`npm install` starts crashing that way again after removing it, that's why.

## Release engineering

Four workflows, all under `.github/workflows/`. Every one of them sets a `concurrency` group so
a superseded run is cancelled rather than left burning a runner; `cancel-in-progress` is scoped
to `pull_request` events so that each commit on `main` keeps a result of its own, and the
release workflow never cancels at all (a half-uploaded set of installers is worse than a slow
build).

**`ci.yml`** — on pushes to `main` and on every PR. Three jobs:

- `verify` (ubuntu): lint, `format:check`, build, and `test:coverage`, then `coverage:summary`
  into the run summary and the raw `coverage/` directories as an artifact.
- `package` (windows + macos + ubuntu, `fail-fast: false`, `needs: verify`): `npm run
package:dir` followed by the Playwright suite against the packaged app. **This is the job that
  earns its keep.** Everything in `verify` runs against source on one Linux box; every landmine
  in "Packaging" above (the hoisted-monorepo production-dependency walk, the vendored `shared`
  symlink, the `better-sqlite3` native binary, a sandboxed preload that can't resolve something,
  a too-strict production CSP) is platform-specific and only reachable through a real package +
  launch. It gates on `verify` so a lint typo doesn't burn three runners.
  - `--publish never` (baked into `package:dir`) is **required**, not tidiness: electron-builder
    switches publishing on _implicitly_ when it detects CI, and on a tag it defaults to `onTag`.
    Without the flag a CI run could start writing to a GitHub release.
  - Linux needs `xvfb-run` for the e2e step; macOS and Windows runners launch GUI apps directly.
  - Both jobs cache the Electron/electron-builder download caches, keyed on `package-lock.json`.
    Electron's binary zip is ~100 MB per platform per run otherwise.
- `audit`: `npm audit --audit-level=high` off the lockfile (no install needed), and
  `continue-on-error: true`. That is a deliberate trade-off, not an oversight — `electron` is a
  devDependency here (electron-builder requires it to be), so `--omit=dev` would hide the
  advisories that matter most, while auditing the full tree means a new advisory in the Angular
  or lint toolchain would turn a consumer's CI red on a commit that changed nothing. Dependabot
  security updates are the mechanism that actually fixes these; the step is here so you see
  them. Delete the `continue-on-error` line to make it blocking.

**`release.yml`** — on `v*` tags. A `draft` job creates the draft GitHub Release once, up front,
then a three-platform `build` matrix builds real installers into it. The ordering is the point:
if all three jobs raced to create the release themselves, the losers would 422.

- It **validates the tag shape** (`v<major>.<minor>.<patch>[-pre]`) and then writes the version
  into `workspaces/electron-app/package.json` with `npm version --allow-same-version
--no-git-tag-version`. The tag is the single source of truth. Skip this and the installers and
  `latest.yml` carry whatever was committed, electron-builder looks for the wrong release tag,
  and electron-updater — which compares against exactly that version — never sees the release as
  newer.
- It publishes with **electron-builder's own publisher** (`--publish always` + `GH_TOKEN`), not
  `gh release upload`. This is load-bearing: for the github provider electron-builder rewrites
  the asset names in `latest.yml` to a space-free "safe" form
  (`Electron-Angular-Boilerplate-Setup-1.0.0.exe`) and uploads under exactly those names, while
  the files on disk keep their spaces. Uploading the on-disk names by hand leaves `latest.yml`
  pointing at assets that don't exist and auto-update 404s on every check.
- The release is left as a **draft**. Nothing reaches users, and electron-updater cannot read a
  draft, so publishing it by hand is the deliberate act that ships an update. A final step fails
  the build if no `latest*.yml` was produced — without that, broken auto-update would be
  invisible until users failed to get an update they were never told about.
- The only secret used is the automatic `GITHUB_TOKEN`; the job requests `contents: write`.

**`codeql.yml`** — `javascript-typescript` with `build-mode: none`, so there is no install/build
to keep in sync with the rest of CI. Covers all four workspaces, main process and renderer
alike. Runs on push/PR plus weekly, because on a quiet repo most findings arrive from newly
added queries rather than from a commit.

**`dependabot.yml`** — see "Dependencies" below.

### Cutting a release

```
npm version <major|minor|patch>   # or edit workspaces/electron-app/package.json
git tag v1.2.3 && git push origin v1.2.3
```

Then open the draft release Actions created, check the generated notes, and publish it. The tag
is what drives everything; the committed version in `electron-app/package.json` only matters for
local builds, since the workflow overwrites it from the tag.

## Auto-update

`electron-app/src/updater.ts` wires `electron-updater`'s `autoUpdater` to the GitHub Releases
feed, and `main.ts` calls it from `whenReady` _after_ `createWindow()` so a slow or failing check
never delays first paint. Updates download in the background and install on quit; when one is
ready the user gets a "Restart now / Later" dialog. It re-checks every six hours, because a
desktop app that stays open for days would otherwise only ever check at launch.

It is written to be safe to call unconditionally and no-ops in the two cases where updating
cannot work:

- **Not packaged** — there is no installed app to replace.
- **No `app-update.yml`** in `process.resourcesPath`. electron-builder only writes that file for
  real installer targets, so every `--dir` build — including the ones CI and `npm run test:e2e`
  produce — lacks it. Without this guard the packaged app would error on launch in exactly the
  place the e2e suite runs. (`process.resourcesPath` is also undefined outside Electron, which is
  why `hasUpdateFeed()` checks it before joining a path.)

Every failure path is logged and swallowed rather than thrown — no network, an unpublished
release and an unsigned macOS build all surface as a failed check, and none of them is a reason
to take down the app the user actually launched.

**Two things a consumer must supply before updates reach anyone:**

1. **A published, non-draft release.** See `release.yml` above.
2. **Code signing, which this template does not configure.** On macOS this is not optional:
   Squirrel.Mac refuses to swap in an app whose signature doesn't match the running one, so
   auto-update on an unsigned/un-notarized build always fails. Add certs via electron-builder's
   `CSC_LINK`/`CSC_KEY_PASSWORD` (and `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`
   for notarization) as repo secrets, and drop the `CSC_IDENTITY_AUTO_DISCOVERY: false` line from
   `release.yml` that currently keeps unsigned macOS builds deterministic. On Windows an unsigned
   NSIS update installs fine but SmartScreen warns the user. Linux AppImage updates need neither.

To remove auto-update instead: delete `updater.ts`, its spec and the `initializeAutoUpdater()`
call in `main.ts`, and drop `electron-updater` from `electron-app`'s dependencies. Leave
`build.publish` in place if you still want `latest*.yml` generated for a manual update flow.

## Dependencies

Staying current is most of a boilerplate's value, so `.github/dependabot.yml` runs Dependabot
weekly over the npm workspaces (one `directory: /` entry covers every workspace manifest — it
reads the root `package.json`'s `workspaces` field) and over the GitHub Actions in CI.
Dependabot rather than Renovate specifically because this is a GitHub _template_: it needs no
app install, so it works on a consumer's fork the moment they click "Use this template".
Angular, the lint/format toolchain, the test toolchain and the electron-builder/electron-updater
pair are each grouped into a single PR — they only resolve against each other, so per-package
PRs would just fail. (electron-builder and electron-updater are one group because they ship
from the same project and share an exactly-pinned `builder-util-runtime`.) `electron` and
`better-sqlite3` majors are still ignored and taken by hand: CI now packages on all three
platforms, which covers most of that ground, but it builds with `--dir` and does no signing,
so a real `npm run package` and a look at a tagged release build are still worth doing for an
ABI-moving major.

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

## Main-process lifecycle

`main.ts` is deliberately thin — window creation and the `app` event wiring — with the pieces
that have their own rules split out. Several of these exist to keep the template from shipping
a developer's local setup or a debugging affordance to end users; don't "simplify" them away:

- **Navigation guards** (`security.ts`, `attachNavigationGuards`) are attached once, centrally,
  from `app.on('web-contents-created')` — which fires for the main window's own webContents too,
  so `createWindow` must not attach them again or every listener doubles. `setWindowOpenHandler`
  denies all `window.open`/`target="_blank"` and hands http(s) URLs to the system browser;
  `will-navigate`/`will-redirect` allow only the app's own content (the dev-server origin in dev,
  anything under `renderer/` when packaged) and `will-attach-webview` is refused outright. These
  are items 12–13 of Electron's security checklist and the counterpart to `sandbox: true`.
- **Single-instance lock**: `app.requestSingleInstanceLock()` gates all of the `app` wiring. Two
  instances would mean two TypeORM DataSources on one SQLite file, so a second launch just
  focuses the running window and exits.
- **Window geometry** is persisted to `window-state.json` in `app.getPath('userData')`
  (`windowState.ts`) and restored onto the **primary** display, with the saved position dropped
  if it no longer intersects a connected display. A template must not hardcode a display index.
- **`show: false` + `ready-to-show`** avoids a white flash on cold start; the window is only
  shown once the renderer has something to paint.
- **`render-process-gone`** recreates the window, but tracks crashes in a rolling window — a
  renderer that crashes on load would otherwise respawn forever. Past the threshold it shows an
  error box and exits.
- **`uncaughtException`** logs, shows an error box and calls `app.exit(1)`. A main process that
  has thrown past its own handlers has unknown state and shouldn't keep serving IPC over the
  database.
- **The app menu** (`menu.ts`) is installed explicitly, because Electron's default menu ships
  Reload/Force Reload/Toggle DevTools. Those items are added only when `!app.isPackaged`.

## Notes

- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` in
  `electron-app/src/main.ts` — the standard secure Electron `webPreferences` combination.
  `preload.ts` only uses `contextBridge`/`ipcRenderer` plus pure-TS validation from `shared`,
  which all work under a sandboxed preload; keep it that way (no `fs`/other Node built-ins in
  preload or in anything `shared` exports) if you don't want to revisit this.
- The SQLite file path is resolved relative to `__dirname` (not `process.cwd()`), so it works
  regardless of the process's working directory: dev uses `electron-app/data/boilerplate.sqlite`,
  packaged builds use `app.getPath('userData')`. Reached through `getDataSource()`, which
  resolves that path on first call rather than at import. See
  `electron-app/src/database/sqlite.config.ts`.
- Logging goes through `electron-app/src/logger.ts` (`electron-log`, level gated by
  `app.isPackaged`) rather than raw `console.*` in the main process.
- Fonts are bundled via `@fontsource/roboto` and `@fontsource/material-icons`, imported from
  `angular-app/src/styles.css` — not fetched from `fonts.googleapis.com`. A desktop app
  shouldn't need the network to render correctly, and keeping them local is what lets the
  packaged CSP stay `'self'`-only. `@fontsource/material-icons` ships only the `@font-face`, so
  `styles.css` also carries the `.material-icons` ligature rules Google's stylesheet supplied —
  without them `<mat-icon>` renders its name as text.
