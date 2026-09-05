import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = fileURLToPath(new URL('.', import.meta.url));
const releaseDir = join(e2eDir, '..', '..', 'release');

// Extension-less binaries Electron ships next to the app on Linux; see the linux branch below.
const ELECTRON_LINUX_HELPERS = new Set(['chrome-sandbox', 'chrome_crashpad_handler']);

// Resolves the electron-builder --dir output produced by `npm run package -- --dir` (see
// root package.json's "test:e2e" script) to the actual app executable, per OS. All three
// branches are exercised by CI's package job. Each throws with the directory it searched rather
// than returning a wrong path - a bad executable path surfaces from Playwright as a bare
// "Process failed to launch!", which says nothing about where it looked.
export function resolvePackagedExecutable(): string {
  if (!existsSync(releaseDir)) {
    throw new Error(`No packaged app found at ${releaseDir}. Run "npm run package -- --dir" first.`);
  }

  if (process.platform === 'win32') {
    const dir = join(releaseDir, 'win-unpacked');
    const exe = readdirSync(dir).find((f) => f.endsWith('.exe'));
    if (!exe) throw new Error(`No .exe found in ${dir}.`);
    return join(dir, exe);
  }

  if (process.platform === 'darwin') {
    const macDir = readdirSync(releaseDir).find((f) => f.startsWith('mac'));
    if (!macDir) throw new Error(`No mac* output directory found in ${releaseDir}.`);
    const appBundle = readdirSync(join(releaseDir, macDir)).find((f) => f.endsWith('.app'));
    if (!appBundle) throw new Error(`No .app bundle found in ${join(releaseDir, macDir)}.`);
    const macOsDir = join(releaseDir, macDir, appBundle, 'Contents', 'MacOS');
    const binary = readdirSync(macOsDir)[0];
    if (!binary) throw new Error(`No binary found in ${macOsDir}.`);
    return join(macOsDir, binary);
  }

  if (process.platform === 'linux') {
    const dir = join(releaseDir, 'linux-unpacked');
    // The binary is named after the app package's `name` (`electron-app`), not productName, so
    // there's nothing fixed to match on. Everything else at this level is a directory, a file
    // with an extension, or one of Electron's own extension-less helper binaries - so ruling
    // those out leaves exactly the app. Matching on "first name without a dot" instead picked
    // chrome-sandbox, which launches and exits immediately.
    const candidates = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.includes('.') && !ELECTRON_LINUX_HELPERS.has(entry.name))
      .map((entry) => entry.name);
    if (candidates.length !== 1) {
      throw new Error(
        `Expected exactly one app binary in ${dir}, found ${candidates.length}` +
          `${candidates.length ? `: ${candidates.join(', ')}` : ''}.`
      );
    }
    return join(dir, candidates[0]);
  }

  throw new Error(`Unsupported platform for e2e: ${process.platform}`);
}
