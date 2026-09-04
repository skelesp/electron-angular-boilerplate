import { describe, it, expect, afterAll, vi } from 'vitest';
import { noteEndpoints } from '@electron-angular-boilerplate/shared';

// handlersRegistry.ts imports `ipcMain` from 'electron' directly, and imports note.handler.ts
// which (via sqlite.config.ts and logger.ts) needs `app` from 'electron' too - both crash
// outside a real Electron process. See note.handler.spec.ts for why the DataSource has to be
// built inside vi.hoisted's own dynamic imports rather than via this file's top-level imports.
const testDataSource = await vi.hoisted(async () => {
  await import('reflect-metadata');
  const { DataSource } = await import('typeorm');
  const { NoteRecord } = await import('./models/notes/Note.entity');
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    entities: [NoteRecord],
  });
  await dataSource.initialize();
  return dataSource;
});

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { isPackaged: false, getPath: () => '/tmp' },
}));
vi.mock('./database/sqlite.config', () => ({ AppDataSource: testDataSource }));

const { wrapHandler } = await import('./handlersRegistry');

describe('wrapHandler', () => {
  const channel = noteEndpoints.create.channel;

  afterAll(async () => {
    await testDataSource.destroy();
  });

  it('returns a 400 envelope without calling the handler when input fails validation', async () => {
    const handler = vi.fn();
    const wrapped = wrapHandler(channel, handler);

    const result = await wrapped({ title: '' /* missing content, empty title */ });

    expect(result).toMatchObject({ status: 'error', error: { code: 400 } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns a 500 envelope when the handler throws', async () => {
    const wrapped = wrapHandler(channel, async () => {
      throw new Error('boom');
    });

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(result).toEqual({ status: 'error', error: { code: 500, details: 'boom' } });
  });

  it('passes validated input through and returns the handler result unchanged for valid input', async () => {
    const fakeResult = { status: 'success' as const, data: { id: '1' } };
    const handler = vi.fn().mockResolvedValue(fakeResult);
    const wrapped = wrapHandler(channel, handler);

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(handler).toHaveBeenCalledWith({ title: 'ok', content: 'ok' });
    expect(result).toBe(fakeResult);
  });
});
