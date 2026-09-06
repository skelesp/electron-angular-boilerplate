## What this changes

<!-- One or two sentences. If it fixes an open issue, write "Fixes #123" so GitHub closes it. -->

## Why

<!-- The problem, not the patch. For a change to a non-obvious constraint (packaging, the
     preload bundle, the migrations list, the CSP), say what breaks without it - that reasoning
     belongs in CLAUDE.md too. -->

## How to verify

<!-- The commands or the click-path a reviewer should follow. -->

## Checklist

- [ ] `npm run lint` and `npm run format:check` pass
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes, or the change cannot affect the packaged app
- [ ] New spec files are listed in their workspace's `eslint.config.mjs`
- [ ] An entity change ships with a generated migration, added to
      `electron-app/src/database/migrations/index.ts`
- [ ] `CLAUDE.md` and `README.md` reflect any changed script, workflow or constraint
- [ ] `CHANGELOG.md`'s `[Unreleased]` section is updated for a user-visible change
- [ ] The commit messages follow Conventional Commits
