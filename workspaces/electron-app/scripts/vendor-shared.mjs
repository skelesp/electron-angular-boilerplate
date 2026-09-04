import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// electron-builder packages workspaces/electron-app in isolation (directories.app) and walks
// its dependency tree via real Node module resolution, following symlinks to their real path.
// @electron-angular-boilerplate/shared is an npm-workspaces symlink pointing outside that
// directory (at workspaces/shared) - a real path with no "node_modules" segment - which trips
// electron-builder's asar packer ("<path> must be under <appDir>").
//
// Node module resolution always checks the closest node_modules first, so copying a real
// (non-symlink) snapshot of the compiled package into electron-app's own node_modules here
// makes electron-builder (and Node, if it were ever run this way) resolve the local copy and
// never walk out to the workspace symlink. This only runs for packaging (`npm run package`'s
// prepackage/postpackage hooks) - never as part of `npm start`/`npm run build` - specifically
// so normal dev sessions keep resolving the *live* `workspaces/shared` symlink (needed for
// `npm run watch:shared` to hot-update electron-app/angular-app) instead of this snapshot.
const electronAppDir = dirname(dirname(fileURLToPath(import.meta.url)));
const sharedDir = join(electronAppDir, '..', 'shared');
const dest = join(electronAppDir, 'node_modules', '@electron-angular-boilerplate', 'shared');

const shouldRemove = process.argv.includes('--remove');

rmSync(dest, { recursive: true, force: true });

if (shouldRemove) {
  console.log(`[vendor-shared] Removed vendored copy at ${dest}`);
} else {
  cpSync(join(sharedDir, 'dist'), join(dest, 'dist'), { recursive: true });
  cpSync(join(sharedDir, 'package.json'), join(dest, 'package.json'));
  console.log(`[vendor-shared] Copied @electron-angular-boilerplate/shared into ${dest}`);
}
