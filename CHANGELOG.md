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

- Source maps are no longer emitted by production Angular builds. `sourceMap` moved out of
  `angular.json`'s shared `options` block into the `development` configuration, where Angular
  puts it by default. It was shipping 4 MB of `.map` files inside `app.asar` — two thirds of the
  packaged renderer — along with a readable copy of the renderer's TypeScript.

- `readme.md` is now `README.md`, with CI/CodeQL/license/version badges, screenshots of the
  example app, and a scripts section listing the full set rather than a third of it.
- CLAUDE.md's script reference matches the scripts again: `npm run build` includes
  `copy:renderer`, `electron-app`'s `start` includes `bundle:preload`, and the esbuild preload
  bundling step is documented rather than only warned about in a source comment.
