# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A template repo (npm workspaces monorepo) for a desktop app: Angular frontend (renderer),
Electron main process, a SQLite database via TypeORM, and a **shared, runtime-validated API
contract** between the two — zod schemas in `shared` are the single source of truth for the
TypeScript types, the IPC input validation, the response validation and the payloads of
main → renderer events. Because this is a GitHub template, treat
the boilerplate's own conventions (not any single feature) as the thing to keep consistent.

## Commands

Run from the repo root unless noted.

```
npm install
npm start                      # build:shared, then run watch:shared + Angular dev server + Electron concurrently
```

- `npm run init` — rewrites the template's identity into a consumer's own. See "Initializing a
  copy of the template" below; it is the first thing anyone starting from this repo runs, and
  the only script here meant to be deleted afterwards.
- `npm run build` — builds `shared`, then `electron-app`, then `angular-app`, in that order
  (each depends on the previous), and finishes with `copy:renderer`.
- `npm run build:shared` / `build:electron-app` / `build:angular-app` — build one workspace.
- `npm run copy:renderer` — runs `workspaces/electron-app/scripts/copy-renderer.mjs`, which
  copies the Angular browser build into `electron-app/renderer/`. It is the last step of
  `build` (and so of `prepackage`) rather than only a packaging step: `renderer/` is what a
  packaged build loads instead of `localhost:4200`, and it is in `build.files`, so a `build`
  that stopped short of it would leave the previous run's renderer in place — a packaged app
  showing stale UI with no failure anywhere.
- `npm run lint` / `npm run lint:fix` — `compile:shared`, then eslint across all workspaces
  (`npm run lint --workspaces --if-present`). The `compile:shared` prefix is load-bearing, not
  a convenience: every other workspace imports `@electron-angular-boilerplate/shared`, whose
  `main`/`types` point at its `dist`, so on a checkout that has never been built
  `import-x/no-unresolved` flags every one of those imports and the type-aware rules see `any`.
  A working copy normally has a `dist` from the last build, which is why that only ever showed
  up in CI. `compile:shared` runs `shared`'s `build:prod` (`tsc --build .`) rather than
  `build:shared`: incremental (~0.5s when up to date) and, unlike `build:shared`, it does not
  `rimraf dist` first — which would blow a hole in a running `npm start` session every time
  someone linted. Linting a single workspace directly (`npm --workspace=… run lint`) skips this
  and needs `shared` already built.
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

- `shared`: `compile`/`build`/`build:prod`/`watch`, all of which write the `dist/*/package.json`
  markers and then `tsc --build` **both** of its projects (`tsconfig.json` and
  `tsconfig.esm.json`) — see "`shared` is dual-published" below. `dev` is an alias of `watch`.
- `electron-app`: `start` (`tsc && npm run bundle:preload && electron .`) — expects Angular
  already serving at `localhost:4200`; `compile` (`tsc --build`, then `bundle:preload`);
  `bundle:preload` (esbuild — see the section below, and don't drop it);
  `migration:generate` / `migration:run` / `migration:revert` for TypeORM migrations.
- `angular-app`: `start` (`ng serve`), `watch` (`ng build --watch`).

VS Code: the `Electron+Angular debug` launch compound (`.vscode/launch.json`) runs the
`Build.All` task, then attaches to both the Electron main process and the Chrome renderer at
`localhost:4200` on port 9224.

`shared` and `electron-app` use TypeScript project references (`tsc --build`) with
`composite: true`; `angular-app` also references `shared`. Because `shared` is built twice
(see the next section but one), those references name a specific half: `angular-app` points at
`../shared/tsconfig.esm.json`, and `electron-app` points at both. If cross-workspace types look
stale, rebuild `shared` first — everything else imports from `@electron-angular-boilerplate/shared`'s
compiled `dist`, not its source.

## The preload script is bundled with esbuild, not emitted by tsc

`dist/preload.js` is the one output in this repo that `tsc` does **not** produce. It is built
by `electron-app`'s `bundle:preload` script:

```
esbuild src/preload.ts --bundle --platform=node --format=cjs --sourcemap --external:electron --outfile=dist/preload.js
```

which runs as part of both `start` and `compile`, so nobody invokes it by hand — and that is
exactly why it is easy to delete by accident while "simplifying" the build.

The reason it exists is `webPreferences.sandbox: true` (`main.ts`). A sandboxed preload script
can `require()` only Node builtins and `electron`; it has no module resolution into
`node_modules`. `preload.ts` imports `isValidChannel` / `isValidEventChannel` from
`@electron-angular-boilerplate/shared` to allowlist IPC channels, so a plain `tsc`-emitted
`preload.js` would carry a bare `require('@electron-angular-boilerplate/shared')` that throws
at load. The failure is quiet in the worst way: the preload dies, `contextBridge` never runs,
`window.electronAPI` is simply absent, and the renderer reports a missing bridge rather than a
build error. Bundling inlines those dependencies into one self-contained CommonJS file.

Three consequences worth keeping in mind:

- **`--external:electron` is required**, not an optimization: `electron` is resolved by the
  runtime and must stay a bare `require`.
- **`--format=cjs` is pinned explicitly.** Preload scripts are loaded as CommonJS.
  `electron-app` is already `"type": "commonjs"`, so the flag is redundant today — it is there
  so that a future switch of that field doesn't silently emit an ESM preload.
- **Nothing reachable from `preload.ts` may use a Node built-in beyond what a sandboxed
  preload allows.** That constrains what `shared` is allowed to export — see "Notes" at the
  bottom of this file. esbuild will happily bundle an `fs` import and the failure appears only
  at runtime, in a packaged build.

`workspaces/e2e` is what actually catches a regression here, since a broken bridge only shows
up once the app is packaged and launched.

One more thing to know about this bundle: **esbuild picks the export condition from the import
kind, not from the output format.** `preload.ts` reaches `shared` with an `import` statement, so
esbuild takes the `import` condition and inlines the **ESM** build even though `--format=cjs`
makes the result CommonJS. That is fine — and it is why `electron-app`'s tsconfig references
both halves of `shared`. See the next section.

## `shared` is dual-published: ESM for the renderer, CommonJS for the main process

`shared` is compiled twice from one source tree, and an `exports` map in its `package.json`
hands each consumer the half it wants:

```
workspaces/shared/
  tsconfig.json          module: CommonJS  ->  dist/cjs/   (+ package.json {"type":"commonjs"})
  tsconfig.esm.json      module: ES2022    ->  dist/esm/   (+ package.json {"type":"module"})
```

The reason is a warning the Angular production build used to print on every run — `Module
'@electron-angular-boilerplate/shared' … is not ESM. CommonJS or AMD dependencies can cause
optimization bailouts.` The renderer is the only consumer that wants ESM, and the main process
must keep getting CommonJS, so neither format alone is right. This is the same shape `zod` —
this package's only dependency — already ships.

Who ends up with which, and by what mechanism:

| consumer                                                             | mechanism                                                                         | gets       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| `electron-app`'s `tsc` (`module: CommonJS`, no `moduleResolution`)   | resolves as node10, which **ignores `exports`** entirely and reads `main`/`types` | `dist/cjs` |
| the packaged main process (`"type": "commonjs"`, `require()`)        | `exports` → `require` condition                                                   | `dist/cjs` |
| `preload.ts` via esbuild                                             | `import` statement → `import` condition                                           | `dist/esm` |
| `angular-app` (`moduleResolution: "bundler"`) and the Angular build  | `exports` → `import` condition                                                    | `dist/esm` |
| `electron-app`'s Vitest (externalizes `node_modules`, Node loads it) | ESM import → `import` condition                                                   | `dist/esm` |

Five things here are load-bearing:

- **`main`/`types` still point at `dist/cjs`.** They are not vestigial: node10 resolution — what
  `electron-app`'s tsconfig gets by defaulting `moduleResolution` — cannot read an `exports` map
  at all, so they are the entire contract for the main process's type-checking. Leaving
  `moduleResolution` unset in `shared/tsconfig.json` is deliberate for the same reason: that
  project is the one that mirrors how `electron-app` consumes it.
- **Every relative specifier in `shared/src` carries an explicit `.js` extension**, and
  `src/index.ts` says `'./apiDefinition/index.js'` rather than `'./apiDefinition'`. Node's ESM
  loader has no extension search and no directory-index resolution, so the ESM emit would
  otherwise be loadable by bundlers but not by Node — and `electron-app`'s Vitest externalizes
  `node_modules` and hands it to Node's own loader, so that is not a hypothetical. TypeScript
  resolves `'./registry.js'` to the source `registry.ts` under both node10 and bundler
  resolution, and both emits pass the specifier through verbatim, which is what lets one source
  tree serve both. **A new file in `shared/src` must follow this.**
- **`dist/cjs/package.json` and `dist/esm/package.json` are generated**, by
  `shared/scripts/write-dist-manifests.mjs`. Both directories are full of plain `.js` files, and
  the nearest `package.json`'s `type` field is the only thing that tells a Node-style loader
  which dialect it is reading — something the package's own manifest can only say once. Every
  `shared` script that runs `tsc` runs that script **first**, not after, so one invocation also
  covers `--watch` and a preceding `rimraf dist` can never leave a build unmarked.
- **`electron-app` references both projects**, `../shared` and `../shared/tsconfig.esm.json`.
  It type-checks against the CommonJS one, but its `compile` is `tsc --build . && npm run
bundle:preload`, and that esbuild step resolves into `dist/esm` (see above). Without the
  second reference, `npm --workspace=workspaces/electron-app run compile` on a tree where
  `shared` was never built would bundle against a directory that doesn't exist.
- **`tsBuildInfoFile` is pinned** to the workspace root in both projects. With a nested `outDir`
  tsc defaults it to inside `dist/` — and `vendor-shared.mjs` copies `dist/` wholesale into the
  packaged app, so the default would ship a build artifact inside `app.asar`.

`vendor-shared.mjs` needs no special handling for any of this, and that is worth preserving:
everything the `exports` map names lives under `dist/` or is `package.json` itself, which is
exactly the pair it already copies. An `exports` entry pointing anywhere else would break the
packaged app only — dev resolves through the live workspace symlink and would look fine.

## Initializing a copy of the template

`scripts/init.mjs` (`npm run init`) is what turns this repo into someone's own project. It
prompts for a product name, npm scope, appId, author, description, SQLite filename and GitHub
repository — or takes them as flags (`--name`, `--scope`, `--app-id`, `--author`,
`--description`, `--database`, `--repo`, plus `--yes`, `--dry-run` and `--force`) — and
rewrites all of them in place.

The friction it removes is real: `@electron-angular-boilerplate/shared` alone appears in about
twenty files across three workspaces, the lockfile and this document, and a rename that misses
one fails at `import`, not at review time. Six substituted tokens — the scope, the product
name, the appId, the SQLite filename, the repository slug and its owner — plus the LICENSE
copyright line are the whole of the template's identity, and `PLACEHOLDER` at the top of the
script is the single source of truth for them. Introduce a seventh and it goes there and in
`buildSubstitutions()`, rather than into a list of things a consumer is told to grep for.

`buildSubstitutions()` returns them **ordered longest-match-first**, because several are
substrings of others: `skelesp/electron-angular-boilerplate` contains the scope, and `skelesp`
is a prefix of the slug. Rewriting the bare scope first would leave a half-rewritten URL behind.
The two repository substitutions are also skipped entirely when the answer is empty (no
`origin` remote, or a non-GitHub one) — substituting an empty string would delete the owner out
of every URL rather than leaving the placeholder for a human to fix, so the script warns instead.

Five properties of it are load-bearing:

- **No dependencies, plain Node.** It has to run _before_ `npm install`, because renaming
  `@<scope>/shared` invalidates the workspace symlinks an earlier install created. The readme
  documents that order (`npm run init`, then `npm install`), and the script's closing output
  says so again when it finds an existing `node_modules`.
- **It skips itself.** `selfPath` is excluded from the walk: this is the one file where the
  placeholders are supposed to appear verbatim, and substituting them would leave the script
  unable to recognise what it had already done.
- **It plans before it writes.** Every `plan*` function collects `{path, contents}` into a map,
  so `--dry-run` reports exactly what a real run does, and a validation failure aborts with
  nothing half-written.
- **Its output stays format-clean.** `format:check` runs in CI on a consumer's very first push,
  so the JSON it rewrites is emitted as Prettier emits it (two-space `JSON.stringify` plus a
  trailing newline) and the readme's `<!-- template-only:start -->` / `<!-- template-only:end -->`
  blocks are stripped along with their trailing blank lines. If you change what init writes,
  re-check that a freshly initialized copy still passes `npm run format:check`.
- **It matches file names exactly, case included.** `edits` is a map keyed by path, so
  `planReadmeRewrite` reads and writes `README.md` — the file's real name. On a
  case-insensitive filesystem a `readme.md` key would pass `existsSync`, sit in the map
  _alongside_ the walk's `README.md` key, and the two would write the same file twice in Map
  order, with the token substitutions losing. Same reason `TEXT_FILENAMES` exists next to
  `TEXT_EXTENSIONS`: `.github/CODEOWNERS` has no extension and would otherwise be skipped,
  leaving a consumer's pull requests requesting review from this template's author.

The product name is validated against quotes, backslashes, angle brackets and `&` because it is
substituted verbatim into a single-quoted TypeScript string (`app.component.ts`), an HTML
`<title>` and raw JSON — contexts with three different escaping rules. Rejecting those few
characters is proportionate; making the substitution context-aware is not.

`README.md`'s template-only blocks hold the "Use this template" framing, the init instructions
themselves, and the screenshots (which are of _this_ template's example app). Anything written
there that stops being true once the repo is someone else's app belongs inside those markers.
The images live in `.github/assets/`; init leaves the files alone — nothing references them
once the block is stripped — and its closing output says so.

## Architecture: the shared API contract

This is the core pattern of the boilerplate and spans all three workspaces. It has two
halves: **request/response** (the renderer asks, the main process answers) and **events**
(the main process pushes, nobody asked). Both are defined in `shared` and validated at the
boundary; the sections below cover them in that order.

### Request/response

To modify or add API surface, changes touch files in this order:

1. **`shared/src/apiDefinition/<domain>/types.ts`** — zod schemas for one domain's input/output
   (TS types are inferred from these, not written separately). Output DTO schemas are
   `z.strictObject`s on purpose — see "Outputs are validated too" below.
2. **`shared/src/apiDefinition/<domain>/endpoints.ts`** — maps each action to an IPC channel
   name plus its input/output schemas.
3. **`shared/src/apiDefinition/registry.ts`** — combines every domain into `apiRegistry`
   (runtime object) and `AppApiRegistry` (compile-time type). Every domain must be added here.
4. **`electron-app/src/models/<domain>/`** — TypeORM entity + repository, a `<Domain>.mapper.ts`
   converting the entity to the contract's DTO, and a `<domain>.handler.ts` with one handler per
   endpoint. Handlers just implement logic and throw
   on error; they do not do their own input validation or response wrapping.
5. **`electron-app/src/database/sqlite.config.ts`** — new entities must be added to the
   `entities` array here. `synchronize` is only on in dev (auto-syncs schema to entities);
   packaged builds run TypeORM migrations instead (`migrationsRun: true`) — after changing an
   entity, generate a migration with `npm --workspace=workspaces/electron-app run migration:generate`
   (uses the standalone CLI data source at `electron-app/src/database/data-source.cli.ts`),
   **add the generated class to `electron-app/src/database/migrations/index.ts`**, and commit
   both alongside the entity change. That list is what the packaged app runs: `dist/` lives
   inside `app.asar` and TypeORM expands a `migrations` glob with a real filesystem walk, which
   matches nothing in there — so a globbed migration silently doesn't run and the app starts on
   an empty database where every query fails with "no such table". Only a machine with no
   database yet hits it, which is why it passed locally and broke on every fresh CI runner. The
   CLI data source still globs, deliberately: it runs from source, outside the archive.
6. **`electron-app/src/handlersRegistry.ts`** — spread the new domain's handlers object into
   `handlersRegistry`. `wrapHandler` (in this file) checks that the invoke came from the app's
   own renderer (see "Every invoke is checked against its sender" below), validates every raw
   IPC payload against the channel's zod input schema before the handler runs, validates the
   response against the channel's output schema on the way back out (in dev), and normalizes
   both success and thrown errors into an `ApiResponse<T>` envelope
   (`{status: 'success', data} | {status: 'error', error}`). This is the one place that
   behavior lives — don't duplicate it in individual handlers.
7. **`angular-app/src/services/<domain>.service.ts`** — calls `ElectronService.invoke(channel, data)`,
   which is typed against `AppApiRegistry` end to end, so a wrong channel name or payload shape
   is a compile error in Angular, not a runtime failure.

### Every invoke is checked against its sender

`wrapHandler` returns `ipcMain.handle`'s own `(event, input)` listener shape rather than an
input-only function, so that `registerAllHandlers` hands it the `IpcMainInvokeEvent` instead of
discarding it. `isTrustedSender` resolves `event.senderFrame?.url` and passes it to
**`security.ts`'s `isInternalUrl`** — the same predicate the navigation guards use — and anything
else gets an `ApiErrorCode.FORBIDDEN` envelope before the channel is even looked up. A null
`senderFrame` (the frame navigated away or closed while the call was in flight) is a rejection
too: there is nothing left to vouch for it.

Reusing `isInternalUrl` is the load-bearing part. A second copy of "is this the app's own
content" would drift, and the failure mode is asymmetric — it either lets a frame the
navigation guards blocked keep invoking IPC, or, much more likely, starts rejecting the real
app's own calls in a packaged build only, where the URL is a `file:` path under `renderer/`
rather than the dev server origin. The e2e suite is what covers that second half, since it is
the only thing here that runs against a packaged app.

This is **defence in depth and nothing else** — today it rejects nothing. A single window, the
navigation guards, `will-attach-webview` being refused outright and preload's channel
allowlist already leave a hostile sender no route to a handler. It is here because each of
those is a separate decision a consumer might reasonably reverse (a second window on a
third-party page, an `<iframe>` for some integration, a guard relaxed for an OAuth redirect),
and this is the last checkpoint before a handler reaches the database. Don't remove it on the
grounds that nothing currently trips it.

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

### Handlers return DTOs, not entities

Every domain gets a `<Domain>.mapper.ts` (`toNoteDto` for the reference domain), mapping the
TypeORM entity to the DTO the contract declares, field by field.

`NoteRecord` and `NoteDto` have the same shape today, so returning the entity straight from a
handler type-checks — and then the first `@Column()` someone adds for internal bookkeeping (a
soft-delete flag, an owner id, a moderation note) is shipped to the renderer by a handler
nobody edited. Listing the fields means adding a column is inert until someone decides to
expose it, and the compiler flags the DTO fields you forgot.

The mapper is the fix; the strict output DTOs and the development-time output validation above
are the backstop for a domain whose author forgot one. Keep both — a boilerplate teaches the
pattern, not just the outcome.

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

### Main → renderer events

The push half. Progress ticks, file-watcher notifications, "the data you're showing just
changed elsewhere" — none of which fit request/response, and all of which a real app needs.

1. **`shared/src/apiDefinition/<domain>/events.ts`** — an `EventDefinition` per event: a channel
   name and a single `payloadSchema` (no input/output pair — events are one-way and have no
   response). `InferEvents` derives the channel → payload type map.
2. **`shared/src/apiDefinition/registry.ts`** — add the domain to `eventRegistry` /
   `AppApiEvents`, the event-side counterparts of `apiRegistry` / `AppApiRegistry`. Domains
   without events simply don't appear there.
3. **`electron-app/src/events.ts`** — `emitAppEvent(channel, payload)` broadcasts to every open
   window, validating the payload against its schema in dev for the same reason responses are
   validated. Broadcasting is the right default for "this application state changed"; a
   per-window event (progress for a job one window started) should take its target explicitly
   instead. `BrowserWindow` is accessed defensively (`BrowserWindow?.getAllWindows?.() ?? []`)
   so a handler that emits stays unit-testable outside Electron.
4. **`electron-app/src/preload.ts`** — `electronAPI.on(channel, listener)` checks the channel
   against `isValidEventChannel` (the same allowlisting `invoke` gets, so a compromised renderer
   can't subscribe to arbitrary IPC), strips the `IpcRendererEvent` — it carries a `sender`
   handle to the main process, which must not cross the bridge — and returns an unsubscribe
   function.
5. **`angular-app/src/services/electron.service.ts`** — `on()` mirrors `invoke()`. Consumers
   register the returned unsubscribe with `DestroyRef.onDestroy`.

`NoteService` is the reference consumer: it subscribes to `note.changed` and reloads on it, and
its `create`/`remove` deliberately **do not** reload afterwards. That covers changes the service
didn't cause (another window, a background job) which a reload-after-my-own-write never can — and
it means the e2e suite exercises the event path by construction, since the list can only update
if the event was actually emitted, bridged and delivered.

The `note` domain (create/get/list/delete plus a `note.changed` event) is a complete reference
implementation of this pattern across all three workspaces (`shared/src/apiDefinition/note/`,
`electron-app/src/models/notes/`, `angular-app/src/services/note.service.ts`, exercised by
`NotesComponent`). Follow its shape for new domains rather than reinventing it.

### A domain with no database behind it

`theme` (`shared/src/apiDefinition/theme/`, `electron-app/src/models/theme/theme.handler.ts`,
`angular-app/src/services/theme.service.ts`) is the second reference domain, and exists to show
that the contract is about the process boundary, not about persistence: it has no entity, no
repository and no mapper, because its store is the operating system, reached through Electron's
`nativeTheme`. It still lives under `models/`, is still registered in `handlersRegistry`, and its
payloads are still validated the same way — what makes something a domain here is the contract in
`shared`.

It is also the clearest illustration of when to push rather than answer: `theme.changed` carries
the whole new state (two fields), so the renderer applies it directly instead of re-fetching,
where `note.changed` carries only what changed and the renderer re-reads through `note.list`.
`startThemeWatcher()` (called from `whenReady`) is what turns Electron's `nativeTheme.on('updated')`
into that event, so flipping the OS dark-mode switch repaints the app with no polling anywhere.
Setting `nativeTheme.themeSource` from the renderer is the point of the write half: it is what
keeps the native chrome — title bar, menus, dialogs — in step with the CSS, which a renderer
reading `prefers-color-scheme` on its own could never do.

Renderer-side IPC access is intentionally narrow: `electron-app/src/preload.ts` exposes exactly
two typed functions — `electronAPI.invoke(channel, data)` and `electronAPI.on(channel, listener)`
— via `contextBridge`, both channel-allowlisted against `shared`, and
`angular-app/src/services/electron.service.ts` is the only place that touches
`window.electronAPI`. Individual Angular services should go through `ElectronService`, not
`window.electronAPI` directly. `ElectronService` reports a missing bridge (a component spec under
jsdom, or `ng serve` opened in a plain browser) as a rejected promise / a warned no-op
subscription rather than a `TypeError` from three frames deep.

## The Angular renderer

Zoneless, signal-based, and deliberately current: this is the half of the template a consumer
evaluates first, so "would Angular's own docs recommend this today?" is the standard to hold it
to.

- **`provideZonelessChangeDetection()`** in `app.config.ts`, and **no `zone.js` polyfill** in
  `angular.json` or in `angular-app`'s dependencies. Change detection is driven by signal reads
  in templates and by template event listeners. The practical rule this imposes: state a template
  reads must be a signal — a plain field mutated from a `setTimeout`, a `Promise.then` or an IPC
  event callback will not repaint. `TestBed` is zoneless by default in Angular 20+, so specs
  needed no zone providers either.
- **`provideBrowserGlobalErrorListeners()`** routes uncaught errors and unhandled rejections
  through Angular's `ErrorHandler`. In a packaged desktop app nobody has DevTools open, so the
  alternative is that they vanish.
- **`provideRouter(routes, withHashLocation())`**. The hash strategy is not a style choice: a
  packaged build is served from `file://`, and the path strategy would have the router pushState
  to file URLs, which a reload or a back/forward then can't load. `#/settings` never leaves
  `index.html`.
- **One lazy route** (`loadComponent` → `SettingsComponent`) as the worked example; the screen the
  app opens on stays eager (`component:`). The e2e suite navigates to it in the _packaged_ app on
  purpose — a lazy chunk fetched over `file://` under the production CSP is exactly the kind of
  thing that works in `ng serve` and fails once shipped.
- **Services expose signals, not `$`-suffixed ones.** `notes`, `loading`, `error` — a `$` suffix
  conventionally means an Observable, and reading these is a synchronous call, not a subscription.
- **`resource()` owns anything loaded asynchronously** (`NoteService.#notes`,
  `ThemeService.#theme`). It runs its loader off an effect, tracks loading/error itself, and gives
  the event subscription a single `reload()` to call — which is why neither service does work in
  its constructor beyond subscribing. That matters most in the specs: a service whose construction
  kicks off an async load forces every test to know it, and the note spec used to stack
  `mockResolvedValueOnce`s in injection order and await bare microtasks to cope. Now it awaits
  `ApplicationRef.whenStable()`, which flushes the effect and waits for the load.
  - `resource.value()` **throws** when the resource is in its error state, `defaultValue` or not,
    so public signals read it behind `hasValue()`.
  - A loader signals failure by throwing; `error()` hands the `Error` back. `theme.changed` and a
    `setSource` response instead write straight into the resource with `set()`, since the payload
    _is_ the new value and re-fetching it would be a round trip for data already in hand.
- **Dark mode is applied with `color-scheme`**, written onto `<html>` by a `ThemeService` effect
  from what the main process reports. Every `light-dark()` value in `styles.css` and the component
  styles resolves against it, as do the scrollbars and form controls the browser draws itself.
  `styles.css` declares `color-scheme: light dark` as the standing default so a renderer opened
  without Electron (or before the first `theme.get` answers) still follows the OS. Angular
  Material's prebuilt themes are light-only; the few surfaces this app paints itself carry their
  own two-value tokens instead, and swapping in a `mat.theme()` SCSS theme is the upgrade path if
  Material's own components need to follow along.
- **Source maps are development-only.** `sourceMap` is set in `angular.json`'s `development`
  configuration, not in the shared `options` block, so `ng build` (which defaults to
  `production`) emits none. It used to sit in `options`, where it applied to both: the maps were
  then copied into `electron-app/renderer/` by `copy-renderer.mjs` and packed into `app.asar` —
  4 MB of maps in a 6 MB renderer, and a readable copy of the app's TypeScript for anyone who
  ran `npx asar extract`. If you want maps in a shipped build for crash symbolication, add
  `"sourceMap": { "scripts": true, "hidden": true }` to the `production` configuration rather
  than moving it back up: `hidden` emits the maps without a `sourceMappingURL` referencing them,
  which keeps the decision to ship or upload them separate from the decision to generate them.
  The main process reaches the same outcome by a different route — it keeps generating maps and
  filters them out at packaging time instead — see "Source maps stop at the package boundary"
  under "Packaging".

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
  any `package.json` here — electron-builder reads `devMetadata.repository` (the root manifest)
  and then `metadata.repository` (the app manifest) _before_ falling back to the git remote, so
  either one would take precedence and point every fork back at the original. **Do not add one**
  — not even "for npm metadata". `homepage` and `bugs` are safe and are set, because
  electron-builder never reads them; `npm run init` rewrites both from the consumer's `origin`.
  The publish config's real job is to make electron-builder emit the `latest*.yml` update
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

### Source maps stop at the package boundary

`build.files` carries two negations immediately after `"dist/**/*"`:

```
"!dist/**/*.map",
"!node_modules/@electron-angular-boilerplate/shared/**/*.map",
```

The root `tsconfig.json` still sets `"sourceMap": true` and the preload bundle is still built
with esbuild's `--sourcemap`, so every map a debugger wants is on disk in
`workspaces/electron-app/dist/` — the VS Code launch compound and its `"sourceMaps": true`
attach configurations are unaffected. They simply don't get copied into `app.asar`. It is
~1.7 MB of the compiled main process's 2.7 MB, and, like the renderer's maps before commit
8b30de8, a readable copy of the app's TypeScript for anyone who runs `npx asar extract`.

The second negation is not redundant: `files` patterns are relative to `directories.app`, so
`dist/**/*.map` matches `electron-app/dist/` only, and the `shared` package that `prepackage`
vendors into `electron-app/node_modules/` (see `vendor-shared.mjs` above) arrives with 13 maps
of its own — now 26, since `shared` is built twice (see "`shared` is dual-published" above);
the `**/*.map` glob covers `dist/cjs` and `dist/esm` alike. It is 34 KB rather than 1.7 MB, but
it is the same first-party TypeScript — the
whole IPC contract — so it goes the same way. `files` negations do apply to `node_modules`
content, which is what makes one mechanism enough; `vendor-shared.mjs` copies `dist` wholesale
and stays out of this. The scope in that path is a template placeholder like any other, and
`npm run init` rewrites it (`PLACEHOLDER.scope`) — if you change it by hand, change it here too.

`shared`'s **ESM build is deliberately not negated out** the way its maps are, even though the
packaged main process only ever `require()`s `dist/cjs` — the preload bundle inlines `dist/esm`
at build time, so nothing in the shipped app reads it. It is ~40 KB, and a `files` negation that
amputated half a dual package would be a trap the first time anything resolved the `import`
condition at runtime: the archive would be missing a path its own `exports` map advertises, and
the failure would appear only in a packaged build.

The argument for shipping them is that `electron-log` writes main-process stack traces to a log
file a user can send to a maintainer, and unmapped traces point into compiled JS — a real
consumer the renderer never had. It does not survive contact with the runtime: **Node does not
apply source maps unless asked, and Electron does not ask.** `process.sourceMapsEnabled` is
`false` in the main process (no `--enable-source-maps`, no `source-map-support` in
`electron-app`'s dependencies), so those log files already carry `dist/**/*.js` frames whether
or not the maps sit beside them. Shipping them bought nothing and disclosed the source.

Turning symbolicated traces on is therefore a **two-part** opt-in, and half of it is not enough:

1. Call `process.setSourceMapsEnabled(true)` early in `main.ts` — before the modules you want
   symbolicated are required, since V8 only consults maps for frames it resolves afterwards.
2. Drop both negation lines, so the maps the runtime now reads are actually in the archive.

Do (1) alone and it reads maps that aren't there; do (2) alone — the state before this
change — and it ships maps nothing reads. If you do both, treat the packaged TypeScript as
published: that is the same trade the renderer's `hidden` maps let you decline.

Third-party maps are deliberately left alone: TypeORM and electron-updater ship ~1,045 of them
inside their own packages, and they disclose nothing that isn't already on npm.

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

`angular-app`'s specs are zoneless, which `TestBed` is by default in Angular 20+ — there is no
zone.js to load and nothing to configure. What changes in practice is how you wait: `await
fixture.whenStable()` (or `ApplicationRef.whenStable()` for a service with no fixture) flushes
effects and pending resources, and is what every spec here awaits instead of counting
microtasks. Renderer specs fake `ElectronService`, not the service under test — a stub of
`NoteService` would only prove the stub works, while a fake `invoke`/`on` pair exercises the
real service, the real resource and the real event subscription.

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

That "resolves to a path string" is also the reason `electron-app`'s `vitest.config.ts` sets
**`ELECTRON_OVERRIDE_DIST_PATH`** in `test.env`. Since Electron 44 the package's entry point
downloads the ~100 MB binary on first `require()` when `node_modules/electron/dist` is missing,
rather than at install time — and Vitest gives each spec file its own worker, so on a machine
that has never launched or packaged the app (every CI runner) six workers fire that download at
once and race each other extracting the same zip: `failed to create '…/LICENSES.chromium.html':
File exists`, and then `Electron failed to install correctly` in whichever worker lost. It is
non-deterministic, so it reads like flake. The env var makes the entry return a joined path
without touching the filesystem or installing anything; that path is never opened. It has to be
an environment variable rather than a Vite alias, because `electron-log` and `electron-updater`
reach for `require('electron')` through Node's own resolution, which `test.alias` never sees.
To reproduce a fresh machine, move `node_modules/electron/dist` and `path.txt` aside.

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

Two specs, run one at a time (`fullyParallel: false` **and** `workers: 1`, because the app takes
a single-instance lock — a second spec file starting in parallel would launch an app that
immediately quits): `note-flow.spec.ts` covers the request/response and event path end to end,
`settings-route.spec.ts` covers the lazy route, hash routing and the `theme` domain. Both launch
through `launchPackagedApp()` rather than calling `electron.launch()` themselves — it drops
`ELECTRON_RUN_AS_NODE` from the inherited environment, which editor- and agent-spawned shells set
and which would otherwise fail every spec with a bare `Error: Process failed to launch!` before
any test body runs (the variable is a real tool — see the diagnosis recipe in "Packaging" — just
not one the suite can survive inheriting). New specs should go through that helper.

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

## Repository conventions and hooks

The files that make this look like a maintained repository rather than a folder of code, and
which a consumer inherits along with everything else.

- **`.editorconfig`, `.nvmrc` (Node 22) and `engines` in the root `package.json`.** The Node
  version is stated in all three places on purpose: `.nvmrc` for `nvm use`, `engines` so npm
  warns on a mismatch, and `node-version: 22` in the workflows. They have to be changed
  together. `.editorconfig` deliberately does **not** set `end_of_line` — git's `core.autocrlf`
  owns the working tree and Prettier is on `endOfLine: "auto"` to follow whatever it finds, so
  pinning it would make an editor fight both on a Windows checkout.
- **husky + lint-staged + commitlint** (`prepare: husky`, `.husky/`, `commitlint.config.mjs`).
  Two hooks: `pre-commit` runs lint-staged, `commit-msg` runs commitlint.
  - lint-staged runs **Prettier only**, not ESLint, and that is deliberate. ESLint's flat config
    resolves from the working directory, and the real rules live in each workspace's own
    `eslint.config.mjs` (Angular rules, the type-aware `projectService`); an `eslint` invoked
    from the repo root against a staged workspace file would silently apply the weaker root
    base config and report a misleading pass. Full linting stays in `npm run lint` and in CI.
  - commitlint's `scope-enum` is the workspaces plus a handful of cross-cutting scopes, and
    includes `deps`/`deps-dev`/`ci` because that is what `.github/dependabot.yml`'s
    `commit-message.prefix` is configured to emit. Change one and change the other.
  - `subject-case` is switched off for the same reason: Dependabot writes sentence-cased
    subjects, and a rule that fails every automated PR gets disabled a week later anyway.
  - Both hooks are skippable with `git commit --no-verify`, and the whole thing is removable by
    deleting `.husky/`, `commitlint.config.mjs`, the `prepare` script, the `lint-staged` block
    and those four devDependencies.
- **Community health files** — `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `CHANGELOG.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md` and
  `.github/ISSUE_TEMPLATE/`. All of them name the repository or its owner, so all of them are
  covered by init's substitutions — see "Initializing a copy of the template" above. The one
  that needs a human decision is `SECURITY.md`: it routes reports to GitHub's private
  vulnerability reporting, which a repository owner has to **enable** in Settings → Security
  before that link works.
- **`README.md`, capitalized**, and `planReadmeRewrite` matches that name exactly. See the
  init section for why the case matters more than convention here.

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

Three version choices deviate from what a resolver would pick on its own, all on purpose:

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
- `typescript` is held at **6.0.x** (`~6.0.3`) even though 7.x is released and `npm outdated`
  reports it, because `@angular/compiler-cli` declares `peerDependencies.typescript` as
  `>=6.0 <6.1`. Angular supports one TypeScript minor at a time and its compiler refuses to
  build outside that range, so TypeScript 7 is not a bump that can be merged here — the pin is
  the Angular peer, not caution. Check the current range with
  `node -e "console.log(require('./node_modules/@angular/compiler-cli/package.json').peerDependencies.typescript)"`
  and revisit when Angular widens it; `.github/dependabot.yml` ignores typescript majors so it
  stops proposing the bump in the meantime. The version is pinned in three manifests — the root,
  `angular-app` and `e2e` — and they move together.

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
  preload or in anything `shared` exports) if you don't want to revisit this. That import from
  `shared` is also why `dist/preload.js` is an esbuild bundle rather than a `tsc` output — see
  "The preload script is bundled with esbuild, not emitted by tsc" above.
- The SQLite file path is resolved relative to `__dirname` (not `process.cwd()`), so it works
  regardless of the process's working directory: dev uses `electron-app/data/boilerplate.sqlite`,
  packaged builds use `app.getPath('userData')`. Reached through `getDataSource()`, which
  resolves that path on first call rather than at import. See
  `electron-app/src/database/sqlite.config.ts`.
- Logging goes through `getLogger()` from `electron-app/src/logger.ts` (`electron-log`, level
  gated by `app.isPackaged`) rather than raw `console.*` in the main process. It's a function,
  not an exported instance, so nothing configures transports at import time — see "Testing".
- Fonts are bundled via `@fontsource/roboto` and `@fontsource/material-icons`, imported from
  `angular-app/src/styles.css` — not fetched from `fonts.googleapis.com`. A desktop app
  shouldn't need the network to render correctly, and keeping them local is what lets the
  packaged CSP stay `'self'`-only. `@fontsource/material-icons` ships only the `@font-face`, so
  `styles.css` also carries the `.material-icons` ligature rules Google's stylesheet supplied —
  without them `<mat-icon>` renders its name as text.
- Roboto is imported by its `latin-<weight>.css` entrypoints, not the bare `<weight>.css` ones.
  The bare entrypoints declare a @font-face per unicode subset — nine of them — so three weights
  emitted 54 font files (941 kB) into `dist/angular-app/browser/media`, against 8 files (413 kB)
  now. On the web that costs nothing, since a browser downloads only the subsets a page's text
  needs; here electron-builder packs the whole `renderer/` directory into the installer either
  way, so an unused subset is pure weight. The trade is that non-latin text falls back to a
  system font — the `latin-` files carry no `unicode-range`, so the fallback happens per
  character against the `font-family` stack. A consumer localizing into Cyrillic or Greek adds
  those subsets back per weight; `styles.css` says how. `@fontsource/material-icons` has no
  equivalent choice: it ships one latin face and `index.css` is already it.
