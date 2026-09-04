import { app } from 'electron';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DataSource } from 'typeorm';
import { NoteRecord } from '../models/notes/Note.entity';
import { logger } from '../logger';

// Resolved from __dirname (not process.cwd()) so it works regardless of the process's
// working directory. Packaged builds use Electron's per-user data directory; dev keeps
// a repo-local file at workspaces/electron-app/data/.
const dbPath = app.isPackaged
  ? join(app.getPath('userData'), 'boilerplate.sqlite')
  : join(__dirname, '..', '..', 'data', 'boilerplate.sqlite'); // dist/database/ -> electron-app/data/

mkdirSync(dirname(dbPath), { recursive: true });

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: dbPath,
  synchronize: !app.isPackaged, // Dev convenience only - packaged builds run migrations instead.
  migrationsRun: app.isPackaged,
  migrations: [join(__dirname, 'migrations', '*.js')],
  logging: ['error', 'schema', 'warn'],
  entities: [NoteRecord], // Add your entities here
});

export async function initializeDatabase() {
  await AppDataSource.initialize();
  logger.info(`[ORM config] Connection established with SQLite database: ${AppDataSource.options.database}`);
}
