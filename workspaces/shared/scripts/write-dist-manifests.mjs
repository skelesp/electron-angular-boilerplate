import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// `shared` is dual-published: tsconfig.json emits CommonJS into dist/cjs and
// tsconfig.esm.json emits ESM into dist/esm, and the "exports" map in package.json hands
// each consumer the right one. Both directories are full of plain `.js` files, so the only
// thing that tells a Node-style loader which dialect it is reading is the nearest
// package.json's "type" field - and the package's own manifest can only say one of them.
// These two one-line manifests are that marker.
//
// Node 22 would in fact recover from a missing dist/esm marker by re-parsing a failed
// CommonJS load as ESM, but nothing should depend on that: it is a fallback for ambiguous
// input, not a declaration, and every other tool in the chain (bundlers included) reads the
// field instead.
//
// tsc cannot emit these itself, so every script in shared's package.json that runs tsc runs
// this first - before rather than after, so that one invocation covers `--watch` too and a
// preceding `rimraf dist` can never leave a build without its markers.
const sharedDir = dirname(dirname(fileURLToPath(import.meta.url)));

const manifests = {
  cjs: { type: 'commonjs' },
  esm: { type: 'module' },
};

for (const [directory, manifest] of Object.entries(manifests)) {
  const target = join(sharedDir, 'dist', directory);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`[write-dist-manifests] Wrote dist/{${Object.keys(manifests).join(',')}}/package.json`);
