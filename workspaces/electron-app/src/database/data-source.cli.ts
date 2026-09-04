import { join } from 'path';
import { DataSource } from 'typeorm';
import { NoteRecord } from '../models/notes/Note.entity';

// Standalone DataSource for the TypeORM CLI (migration:generate/run/revert), which runs
// outside Electron via ts-node - no `electron` import, always points at the dev database.
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: join(__dirname, '..', '..', 'data', 'boilerplate.sqlite'), // electron-app/data/
  synchronize: false,
  migrations: [join(__dirname, 'migrations', '*.ts')],
  entities: [NoteRecord],
});
