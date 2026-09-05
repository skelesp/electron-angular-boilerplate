import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { resetDataSource, setDataSource } from '../database/sqlite.config';
import { NoteRecord } from '../models/notes/Note.entity';

// A fresh in-memory DataSource for tests, independent of the app's real one
// (database/sqlite.config.ts), which resolves a file path under Electron's userData
// directory. Not yet initialized - call `.initialize()` in a `beforeAll` and `.destroy()`
// in the matching `afterAll`, or use `useTestDataSource` below to do both.
export function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    entities: [NoteRecord],
  });
}

/**
 * Installs an initialized in-memory DataSource as the one `getDataSource()` hands out, so
 * handlers under test talk to it instead of the real database. Returns a teardown
 * function for the matching `afterAll`.
 *
 * This is the whole setup a handler spec needs - no `vi.mock`, no `vi.hoisted`, because
 * nothing in the import graph reaches for a database (or for `electron`) until it is
 * called. Keep it that way when you add a domain.
 */
export async function useTestDataSource(): Promise<{ dataSource: DataSource; teardown: () => Promise<void> }> {
  const dataSource = createTestDataSource();
  await dataSource.initialize();
  setDataSource(dataSource);

  return {
    dataSource,
    teardown: async () => {
      resetDataSource();
      await dataSource.destroy();
    },
  };
}
