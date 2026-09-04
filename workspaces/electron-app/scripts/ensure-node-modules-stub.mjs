import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// electron-builder's installOrRebuild() (app-builder-lib/out/util/yarn.js) treats a missing
// `<directories.app>/node_modules` as "dependencies were never installed" and responds by
// running `npm install --production` *scoped to that directory*. In an npm-workspaces
// monorepo, node_modules is hoisted to the repo root, so workspaces/electron-app/node_modules
// never exists on its own - which made every `npm run package` silently run that scoped
// install and prune this repo's hoisted root devDependencies (electron-builder included).
// An empty node_modules here is enough to make electron-builder skip straight to its
// @electron/rebuild step instead, which correctly walks up to the monorepo root.
const electronAppDir = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(electronAppDir, 'node_modules'), { recursive: true });
