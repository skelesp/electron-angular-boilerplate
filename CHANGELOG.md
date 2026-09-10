# Changelog

All notable changes to this template are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), so the
entries below can be assembled from `git log` — see [CONTRIBUTING.md](CONTRIBUTING.md).

> **Versioning note.** The version that ships in a build comes from
> `workspaces/electron-app/package.json`, and the release workflow overwrites it from the git
> tag. The root `package.json` deliberately stays at `0.0.0`. See "Packaging" in
> [CLAUDE.md](CLAUDE.md).

## [Unreleased]

### Added

- A `<mat-icon>` on each note's delete button — the first one in the example UI. Material Icons
  was bundled for `<mat-icon>`'s sake but nothing rendered one, so a build that dropped or
  mis-subset the font looked perfectly fine. The e2e note-flow spec now measures the glyph's
  advance width in the packaged app, which is the only place a missing font file, a broken
  `@font-face` or a CSP that refused it actually shows up.

- `.editorconfig`, `.nvmrc` and an `engines` field, so editors and installs agree on Node 22
  and on the formatting Prettier would produce.
- Community health files: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and
  pull request templates, `CODEOWNERS`, and this changelog.
- husky, lint-staged and commitlint: Prettier runs on staged files on `pre-commit`, and
  commit messages are checked against Conventional Commits on `commit-msg`.
- A `--repo` answer in `npm run init`, defaulted from the checkout's `origin` remote, so the
  badges, links and `CODEOWNERS` entry point at the consumer's repository rather than this one.
  `.github/CODEOWNERS` has no file extension, so init's walk grew a filename allowlist to reach
  it.
- `author`, `homepage`, `bugs` and `private` in the root `package.json`. Still **no**
  `repository` field: electron-builder reads it in preference to the git remote, which would
  make every fork publish its releases back at this repo.

### Changed

- `shared` is dual-published: `dist/cjs` for the Electron main process, `dist/esm` for the
  Angular renderer, selected by an `exports` map. The renderer's production build warned on
  every run that the package "is not ESM", which costs it optimization bailouts, while the main
  process is CommonJS and has to stay that way — so neither format alone was right. `main` and
  `types` still point at the CommonJS build, because `electron-app`'s tsconfig resolves as
  node10 and node10 cannot read an `exports` map at all.

  **This changes how you write code in `shared`:** relative imports there now need an explicit
  `.js` extension (`'./registry.js'`, and `'./apiDefinition/index.js'` for a directory).
  TypeScript still resolves those to the `.ts` source; Node's ESM loader is what requires them,
  and `electron-app`'s Vitest hands the ESM build to that loader directly. See "`shared` is
  dual-published" in [CLAUDE.md](CLAUDE.md).

- Roboto is bundled as its `latin-` subset instead of the full family. `@fontsource/roboto`'s
  bare `<weight>.css` entrypoints declare a @font-face per unicode subset, so three weights
  pulled 54 font files into the renderer — cyrillic, greek, math, symbols, vietnamese and
  latin-ext included. The build's `media/` directory drops from 56 files (941 kB) to 8
  (413 kB), all of which ships in the installer. `@fontsource/material-icons` is unchanged:
  it only ever shipped a single latin face. Non-latin text now falls back to a system font;
  `styles.css` documents how to add subsets back for i18n.

- The `window-all-closed` handler no longer clears the session cache. It fired a floating
  `clearCache()` immediately before `app.quit()`, so it usually never resolved, and there was
  nothing worth clearing either way: dev loads over `localhost` and a packaged build loads over
  `file://`. The platform check that keeps the app alive on macOS is unchanged.

- Source maps are no longer emitted by production Angular builds. `sourceMap` moved out of
  `angular.json`'s shared `options` block into the `development` configuration, where Angular
  puts it by default. It was shipping 4 MB of `.map` files inside `app.asar` — two thirds of the
  packaged renderer — along with a readable copy of the renderer's TypeScript.

- The main process's source maps stop at the package boundary too. `build.files` gained
  `!dist/**/*.map` and a matching negation for the `shared` package that `prepackage` vendors
  into `electron-app/node_modules/`, dropping 33 `.map` files (1.7 MB) from `app.asar`. They
  are still generated — `tsconfig.json` keeps `"sourceMap": true` and the preload bundle keeps
  esbuild's `--sourcemap` — so local debugging and the VS Code launch configurations are
  unchanged. The case for shipping them was symbolicating the stack traces `electron-log`
  writes for users, but `process.sourceMapsEnabled` is `false` in Electron's main process and
  nothing here turns it on, so those traces already pointed into `dist/**/*.js`. CLAUDE.md
  documents the two-part opt-in for consumers who want them symbolicated.

- The production bundle budgets are sized for a desktop renderer: the `initial` budget goes
  from Angular's web defaults (500kB warning / 1MB error) to 1.5MB / 3MB. The initial bundle
  measures ~861 kB, of which ~700 kB is the Angular + Material framework floor, so every build
  printed a budget warning and a consumer was ~140 kB from a hard failure for adding a feature.
  The defaults price in a download over mobile data and a cold HTTP cache, neither of which
  exists when the renderer is read from local disk inside `app.asar`. The limits stay finite —
  parse time and memory are still worth guarding — and `anyComponentStyle` is unchanged.
  `angular.json` carries the reasoning as a comment.

- `readme.md` is now `README.md`, with CI/CodeQL/license/version badges, screenshots of the
  example app, and a scripts section listing the full set rather than a third of it.
- CLAUDE.md's script reference matches the scripts again: `npm run build` includes
  `copy:renderer`, `electron-app`'s `start` includes `bundle:preload`, and the esbuild preload
  bundling step is documented rather than only warned about in a source comment.
