import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiError, ApiErrorCode } from '@electron-angular-boilerplate/shared';
import { useTestDataSource } from '../../test-utils/sqliteTestDataSource';
import { noteHandlers } from './note.handler';

// Note what isn't here: no vi.mock, no vi.hoisted, no stand-in for `electron`. The
// handler resolves its repository through `getDataSource()` when a request arrives rather
// than at import time, so pointing that at an in-memory database is the entire setup. Any
// new domain's spec should look this plain - if it doesn't, something in the import graph
// went back to doing work at module load.
describe('noteHandlers', () => {
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    ({ teardown } = await useTestDataSource());
  });

  afterAll(async () => {
    await teardown();
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

  it('getNote throws a NOT_FOUND ApiError for an unknown id', async () => {
    await expect(noteHandlers['note.get']({ id: 'does-not-exist' })).rejects.toThrow(
      new ApiError(ApiErrorCode.NOT_FOUND, 'Note not found')
    );
  });

  it('deleteNote throws a NOT_FOUND ApiError for an unknown id', async () => {
    await expect(noteHandlers['note.delete']({ id: 'does-not-exist' })).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.code === ApiErrorCode.NOT_FOUND
    );
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
