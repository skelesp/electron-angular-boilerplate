import { _electron as electron, type ElectronApplication } from '@playwright/test';
import { resolvePackagedExecutable } from './resolvePackagedExecutable';

// Launches the packaged app for a spec. Every spec goes through here rather than calling
// electron.launch() itself, so the environment scrubbing below can't be forgotten by the next
// spec someone adds.
export function launchPackagedApp(): Promise<ElectronApplication> {
  return electron.launch({ executablePath: resolvePackagedExecutable(), env: launchEnv() });
}

// Playwright drives the app by appending `--remote-debugging-port=0` to its argv. With
// ELECTRON_RUN_AS_NODE set, Electron skips Chromium entirely and starts as plain Node - so that
// flag reaches Node's option parser, which rejects it, and the whole suite fails before any test
// body runs with a bare "Error: Process failed to launch!" that says nothing about why.
//
// The variable is a legitimate tool (see the packaged-build diagnosis recipe in CLAUDE.md), and
// editor- and agent-spawned shells inherit it from their own Electron parent, so an inner-loop
// run can hit this on a machine where CI is green. Playwright defaults `env` to `process.env`
// and does not filter it, so dropping the variable here is the fix. Values are copied one by
// one because ProcessEnv admits `undefined` and Playwright's env option does not.
function launchEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') {
      env[key] = value;
    }
  }
  return env;
}
