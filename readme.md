# Electron + Angular Boilerplate

A starting point for a desktop app: Angular frontend, Electron main process, a SQLite
database via TypeORM, and a **shared, runtime-validated API contract** between the two
(zod schemas double as the source of truth for both the TypeScript types and the IPC
input validation).

This is a **template repository**. Click "Use this template" on GitHub to start a new,
fully independent project from it - the new repo has no shared history or dependency
on this one, so upgrading this boilerplate later (Angular, Electron, TypeORM, ...)
never affects projects already created from it.

## Project structure

```
/
├── workspaces/
│   ├── angular-app/     # Angular frontend (renderer process)
│   ├── electron-app/    # Electron main process + SQLite/TypeORM
│   └── shared/          # API contract: zod schemas, types, IPC channel registry
├── package.json         # npm workspaces root
└── tsconfig.json
```

### How the API contract works

- `shared/src/apiDefinition/<domain>/types.ts` defines zod schemas (and the types
  inferred from them) for one domain's input/output.
- `shared/src/apiDefinition/<domain>/endpoints.ts` maps each action to an IPC channel
  name and its schemas.
- `shared/src/apiDefinition/registry.ts` combines every domain into `apiRegistry`
  (runtime) and `AppApiRegistry` (compile-time).
- `electron-app`'s `handlersRegistry.ts` validates every incoming IPC payload against
  its channel's zod schema before the handler runs, and always returns an
  `ApiResponse<T>` envelope (`{status: 'success', data} | {status: 'error', error}`) -
  handlers themselves can just throw.
- `angular-app`'s `ElectronService.invoke(channel, data)` is fully typed against
  `AppApiRegistry`, so a mismatched payload or channel is a compile error, not a
  runtime surprise.

A minimal example domain (`note`: create/get/list/delete) is included end-to-end -
shared schema, electron-app TypeORM entity/repository/handler, and an Angular
service + `ApiTesterComponent` - to demonstrate the pattern. Replace it with your own
domain(s).

## Adding a new API domain

**Shared**

1. Create `shared/src/apiDefinition/<domain>/types.ts` and `endpoints.ts`.
2. Define the input/output zod schemas in `types.ts`.
3. Define the channel names and endpoint registry in `endpoints.ts`.
4. Add the domain to `apiRegistry` and `AppApiRegistry` in `registry.ts`.

**Electron app**

5. Create the TypeORM entity/repository under `electron-app/src/models/<domain>/`.
6. Add the entity to `entities` in `database/sqlite.config.ts`.
7. Create a `<domain>.handler.ts` implementing one handler per endpoint.
8. Spread the handler's exported object into `handlersRegistry` in `handlersRegistry.ts`.

**Angular app**

9. Add a `<domain>.service.ts` under `services/` that calls `ElectronService.invoke(...)`.
10. Use it from a component.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- npm

### Getting started

```
npm install
npm start
```

This runs the shared package in watch mode, `ng serve`, and Electron concurrently.
The Electron window loads `http://localhost:4200`.

### Useful scripts

- `npm run build:shared` / `build:electron-app` / `build:angular-app`
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`
- `npm run test` — Vitest suites for `shared`, `electron-app` and `angular-app`
- `npm run test:coverage` — the same suites with coverage reports under each `coverage/`
- `npm run test:e2e` — packages the app and runs the Playwright suite against the **packaged**
  build (slow; also runs in CI on all three platforms)
- `npm run package` — build an installer under `/release`
- `npm run package:dir` — the packaged app tree without an installer, much faster

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

| Job       | Where                  | What                                                          |
| --------- | ---------------------- | ------------------------------------------------------------- |
| `verify`  | ubuntu                 | lint, format check, build, unit tests + coverage summary      |
| `package` | windows, macOS, ubuntu | packages the app and runs the Playwright e2e suite against it |
| `audit`   | ubuntu                 | `npm audit` (advisory — it reports, it doesn't block)         |

The `package` job is the important one. Cross-platform Electron packaging is the part of a
desktop app that actually breaks — native modules, module resolution inside the asar, a preload
script that fails under `sandbox: true`, a CSP that only applies in a packaged build — and none
of it is reachable by building from source on one machine. It runs on all three platforms so
you find out on the PR rather than after a release.

`.github/workflows/codeql.yml` adds GitHub's CodeQL analysis for JavaScript/TypeScript on
push, PR and weekly.

## Releasing

`.github/workflows/release.yml` is triggered by a `v*` tag and builds a real installer on each
platform — NSIS on Windows, dmg + zip on macOS, AppImage on Linux — attaching them all to a
**draft** GitHub Release:

```
npm version <major|minor|patch>   # or edit workspaces/electron-app/package.json
git tag v1.2.3 && git push origin v1.2.3
```

Then open the draft release Actions created for you, review the auto-generated notes, and
publish it when you're ready. Nothing reaches users until you do. The tag is the source of
truth for the version — the workflow writes it into the app before building — and the only
credential involved is the `GITHUB_TOKEN` Actions provides automatically, so this works on a
fresh fork with no setup.

No code signing is configured. See the "Auto-update" section of `CLAUDE.md` for what to add and
which secrets electron-builder expects.

## Auto-update

The app checks GitHub Releases for a newer version on startup and every six hours after that,
downloads it in the background and offers a "Restart now / Later" prompt when it's ready
(`workspaces/electron-app/src/updater.ts`, using `electron-updater`). It resolves the repo it
was built from automatically, so a fork updates from the fork's own releases.

It quietly does nothing in development and in `--dir` builds, which have no update feed, and
never takes the app down when a check fails. Two things you have to supply before updates
actually reach users:

1. **A published (non-draft) release** — electron-updater can't read drafts.
2. **Code signing.** On macOS it's mandatory: an unsigned or un-notarized build can't be
   swapped in by Squirrel.Mac, so auto-update will always fail. On Windows updates work
   unsigned but SmartScreen warns users. Linux AppImage needs neither.

`CLAUDE.md` documents how to wire signing in, and how to remove auto-update entirely if you'd
rather not ship it.

## Staying current

Dependabot is configured in `.github/dependabot.yml` and runs weekly once you've created a
repo from this template — no app to install. Angular, the lint toolchain, the test toolchain
and the electron-builder/electron-updater pair are grouped into one PR each; `electron` and
`better-sqlite3` majors are left for you to take by hand, since they move native/ABI ground
that CI only partly covers (it packages, but builds no signed installers).

## License

MIT
