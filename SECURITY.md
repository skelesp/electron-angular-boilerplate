# Security Policy

## Supported versions

This repository is a **template**, not a distributed application: there is no long-lived
release stream to backport to. Security fixes land on `main`, and projects created from the
template pick them up by applying the change themselves — a repo made with "Use this
template" has no shared history with this one, so there is no automatic update path.

| Version          | Supported |
| ---------------- | --------- |
| `main`           | ✅        |
| Tagged releases  | ❌        |
| Derived projects | ❌        |

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private vulnerability reporting instead:

1. Go to the [Security tab](https://github.com/skelesp/electron-angular-boilerplate/security).
2. Choose **Report a vulnerability**.

That opens a private advisory only the maintainers can see. Include the affected file or
workspace, the version or commit you are on, and enough detail to reproduce.

Expect an acknowledgement within a few days. Since nothing here is deployed, there is no
embargo timeline to negotiate — a fix lands on `main` and the advisory is published with it.

## Scope

The interesting attack surface of this template is the Electron process boundary, and the
choices guarding it are deliberate. In-scope findings are ones that weaken it:

- anything that lets the renderer reach Node or the main process outside the two bridged
  functions in `workspaces/electron-app/src/preload.ts`;
- a way past the IPC channel allowlist, or past the zod input validation in
  `handlersRegistry.ts`;
- a weakening of `contextIsolation` / `nodeIntegration` / `sandbox` in `main.ts`, or of the
  navigation and `window.open` guards in `security.ts`;
- a gap in the packaged Content Security Policy;
- an auto-update path that could install something other than a release from the repo the
  app was built from.

Out of scope:

- vulnerabilities in dependencies with no exploitable path through this code — those are
  Dependabot's job, and CI runs `npm audit` advisorily on every push;
- the absence of code signing. That is documented, not accidental: a template cannot ship
  someone else's certificate. See the "Auto-update" section of [CLAUDE.md](CLAUDE.md) for
  what a consumer has to add, and why an unsigned macOS build can never auto-update.

## If you are shipping an app built from this template

Two things this repository cannot do for you, both of which are security-relevant:

1. **Code-sign and notarize your builds.** Without it macOS auto-update fails outright and
   Windows users get a SmartScreen warning.
2. **Review what your handlers return.** The contract validates DTOs at the boundary, but
   whatever you put in a DTO reaches the renderer. Keep secrets and internal columns out of
   them — that is what each domain's `<Domain>.mapper.ts` is for.
