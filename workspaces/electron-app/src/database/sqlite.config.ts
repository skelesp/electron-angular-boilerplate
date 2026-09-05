import { app } from 'electron';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DataSource } from 'typeorm';
import { NoteRecord } from '../models/notes/Note.entity';
import { isPackagedBuild } from '../env';
import { getLogger } from '../logger';
import { migrations } from './migrations';

function resolveDatabasePath(): string {
  // Resolved from __dirname (not process.cwd()) so it works regardless of the process's
  // working directory. Packaged builds use Electron's per-user data directory; dev keeps
  // a repo-local file at workspaces/electron-app/data/.
  return isPackagedBuild()
    ? join(app.getPath('userData'), 'boilerplate.sqlite')
    : join(__dirname, '..', '..', 'data', 'boilerplate.sqlite'); // dist/database/ -> electron-app/data/
}

function createAppDataSource(): DataSource {
  const dbPath = resolveDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });

  // better-sqlite3 ships an N-API prebuilt binary per platform inside its own package
  // (node_modules/better-sqlite3/prebuilds/<platform>-<arch>.node) and resolves it relative to
  // that package directory, so no nativeBinding path is needed here. Packaged builds only need
  // the package kept outside the asar archive - see `asarUnpack` in the root package.json.
  return new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    synchronize: !isPackagedBuild(), // Dev convenience only - packaged builds run migrations instead.
    migrationsRun: isPackagedBuild(),
    migrations, // Imported, not globbed - a glob matches nothing inside app.asar. See ./migrations/index.ts.
    logging: ['error', 'schema', 'warn'],
    entities: [NoteRecord], // Add your entities here
  });
}

let dataSource: DataSource | null = null;

/**
 * The application's DataSource, created on first call.
 *
 * Deliberately a function rather than an exported `const`: building the DataSource reads
 * `app.isPackaged` and `app.getPath('userData')`, which only exist inside a real Electron
 * process. As a module-level constant that work ran at *import* time, so anything that
 * transitively imported this file - every handler, and therefore `handlersRegistry` -
 * crashed on import under Vitest and had to be mocked out with `vi.mock` before it could
 * be tested at all. Lazily, nothing happens until something actually asks for a
 * connection, and a test can call `setDataSource` first.
 */
export function getDataSource(): DataSource {
  if (!dataSource) {
    dataSource = createAppDataSource();
  }
  return dataSource;
}

/**
 * Point the app at a different DataSource - an in-memory SQLite one in tests (see
 * `src/test-utils/sqliteTestDataSource.ts`). Call it before anything resolves a
 * repository, and `resetDataSource()` afterwards so suites don't leak into each other.
 */
export function setDataSource(source: DataSource): void {
  dataSource = source;
}

export function resetDataSource(): void {
  dataSource = null;
}

export async function initializeDatabase() {
  const source = getDataSource();
  await source.initialize();
  getLogger().info(`[ORM config] Connection established with SQLite database: ${source.options.database}`);
}
