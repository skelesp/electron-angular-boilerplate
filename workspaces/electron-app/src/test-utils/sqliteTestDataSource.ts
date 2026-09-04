import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { NoteRecord } from '../models/notes/Note.entity';

// A fresh in-memory DataSource for tests, independent of the app's real singleton
// (database/sqlite.config.ts), which imports `app` from 'electron' at module load time and
// can't be constructed outside a real Electron process. Not yet initialized - call
// `.initialize()` in a `beforeAll` and `.destroy()` in the matching `afterAll`.
export function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    entities: [NoteRecord],
  });
}
