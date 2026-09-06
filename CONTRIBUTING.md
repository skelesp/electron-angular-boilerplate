# Contributing

Thanks for taking the time to contribute. This repository is a **GitHub template**: what
ships here is a starting point other people copy, so the bar for a change is less "does it
work" and more "does it stay consistent with the conventions already documented in
[CLAUDE.md](CLAUDE.md)". That file is the architecture reference for both humans and coding
agents — read the section covering the area you're touching before you start.

## Getting set up

```
git clone https://github.com/skelesp/electron-angular-boilerplate.git
cd electron-angular-boilerplate
npm install
npm start
```

Node 22 (the version in [.nvmrc](.nvmrc)) and npm 10 or newer. `npm start` builds `shared`,
then runs its watcher, the Angular dev server and Electron together; the window loads
`http://localhost:4200`.

If you are working from a copy of the template rather than on the template itself, run
`npm run init` **before** `npm install` — see the readme.

## Before you open a pull request

```
npm run lint
npm run format:check
npm run build
npm run test
```

That is exactly what the `verify` job in CI runs. Two more things are worth running locally
when your change goes anywhere near packaging, native modules, the preload script or the
production CSP, because they are the only way those surface:

```
npm run test:e2e     # packages the app with --dir, then runs Playwright against it
npm run package      # a real installer under /release
```

CI runs `test:e2e` on Windows, macOS and Linux for every pull request. A failure there is a
real bug, not flake — see the "Packaging" section of CLAUDE.md for the specific landmines
that job exists to catch.

## Conventions

- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)**,
  enforced by commitlint on a `commit-msg` hook: `feat: …`, `fix: …`, `docs: …`, `chore: …`,
  `refactor: …`, `test: …`, `build: …`, `ci: …`. A scope is optional (`fix(electron-app): …`).
  This is what keeps [CHANGELOG.md](CHANGELOG.md) writable from the log.
- **Formatting is not a review topic.** Prettier runs on staged files via a `pre-commit` hook
  (husky + lint-staged). Run `npm run format` if you bypassed it.
- **Adding API surface touches a fixed set of files in a fixed order.** Follow the
  "Adding a new API domain" walkthrough in the readme and the fuller reasoning in CLAUDE.md;
  the `note` (with a database) and `theme` (without one) domains are the reference
  implementations to copy the shape of.
- **New spec files must be listed in their workspace's `eslint.config.mjs`.** Specs are
  excluded from the main `tsconfig.json`, so ESLint's project service needs them named
  explicitly or the lint step fails with "not found by the project service".
- **Renderer state a template reads has to be a signal.** The Angular app is zoneless; a
  plain field mutated from a callback will not repaint.
- **Documentation is part of the change.** If you change a script, a workflow or one of the
  non-obvious constraints, update CLAUDE.md and the readme in the same pull request. Docs
  drifting out of sync with the scripts is the failure mode this template is most exposed to.

## What makes a good change here

Because this is a template, the most valuable contributions are usually one of:

- keeping dependencies current (Angular, Electron, TypeORM) and fixing what that breaks;
- removing setup friction for someone starting a new project;
- documenting a constraint that is easy to break by accident.

Adding a feature to the example `note` or `theme` domains is usually **not** valuable — they
exist to be deleted by whoever uses the template. If an example needs to grow, it should be
because it demonstrates a pattern that isn't demonstrated yet.

## Reporting bugs and security issues

Use the issue templates for bugs and feature requests. **Do not** open a public issue for a
security vulnerability — see [SECURITY.md](SECURITY.md).

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
