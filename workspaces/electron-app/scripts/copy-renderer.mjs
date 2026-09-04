import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const electronAppDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(electronAppDir, '..', 'angular-app', 'dist', 'angular-app', 'browser');
const dest = join(electronAppDir, 'renderer');

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-renderer] Copied Angular browser build\n  from ${src}\n  to   ${dest}`);
