import { describe, it, expect, afterAll, vi } from 'vitest';

// note.handler.ts imports AppDataSource from ../../database/sqlite.config, which imports
// `app` from 'electron' and reads app.isPackaged at module load time - that crashes outside a
// real Electron process. Replacing the whole module with a real, already-initialized test
// DataSource means sqlite.config.ts's implementation (and its `electron` import) never runs.
//
// vi.mock factories can't reference this file's own top-level imports (they're hoisted above
// them), so the DataSource is built inside vi.hoisted's own dynamic imports instead - the
// documented pattern for hoisting an async value a mock factory depends on.
const testDataSource = await vi.hoisted(async () => {
  await import('reflect-metadata');
  const { DataSource } = await import('typeorm');
  const { NoteRecord } = await import('./Note.entity');
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    entities: [NoteRecord],
  });
  await dataSource.initialize();
  return dataSource;
});

vi.mock('../../database/sqlite.config', () => ({ AppDataSource: testDataSource }));

const { noteHandlers } = await import('./note.handler');

describe('noteHandlers', () => {
  afterAll(async () => {
    await testDataSource.destroy();
  });

  it('createNote saves and returns the note', async () => {
    const result = await noteHandlers['note.create']({ title: 'Groceries', content: 'Milk, eggs' });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.title).toBe('Groceries');
      expect(result.data.id).toBeTruthy();
    }
  });

  it('getNote returns a previously created note', async () => {
    const created = await noteHandlers['note.create']({ title: 'Find me', content: 'body' });
    if (created.status !== 'success') throw new Error('setup failed');

    const result = await noteHandlers['note.get']({ id: created.data.id });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.id).toBe(created.data.id);
    }
  });

  it('getNote throws "Note not found" for an unknown id', async () => {
    await expect(noteHandlers['note.get']({ id: 'does-not-exist' })).rejects.toThrow('Note not found');
  });

  it('deleteNote throws "Note not found" for an unknown id', async () => {
    await expect(noteHandlers['note.delete']({ id: 'does-not-exist' })).rejects.toThrow('Note not found');
  });

  it('deleteNote removes a previously created note', async () => {
    const created = await noteHandlers['note.create']({ title: 'Delete me', content: 'body' });
    if (created.status !== 'success') throw new Error('setup failed');

    const result = await noteHandlers['note.delete']({ id: created.data.id });

    expect(result.status).toBe('success');
    await expect(noteHandlers['note.get']({ id: created.data.id })).rejects.toThrow('Note not found');
  });

  it('listNotes reports a totalItems count matching the returned data', async () => {
    const result = await noteHandlers['note.list'](undefined);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.meta?.totalItems).toBe(result.data.length);
    }
  });
});
