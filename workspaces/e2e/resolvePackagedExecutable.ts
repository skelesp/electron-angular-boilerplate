import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = fileURLToPath(new URL('.', import.meta.url));
const releaseDir = join(e2eDir, '..', '..', 'release');

// Resolves the electron-builder --dir output produced by `npm run package -- --dir` (see
// root package.json's "test:e2e" script) to the actual app executable, per OS. Verified against
// a real Windows build; the macOS/Linux branches are best-effort (electron-builder's exact
// output folder name varies by arch/target) - adjust if they don't match your build.
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
    const binary = readdirSync(dir).find((f) => !f.includes('.') && !f.startsWith('.'));
    if (!binary) throw new Error(`Could not find the app binary in ${dir}.`);
    return join(dir, binary);
  }

  throw new Error(`Unsupported platform for e2e: ${process.platform}`);
}
