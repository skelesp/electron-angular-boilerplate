import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { noteEndpoints } from '@electron-angular-boilerplate/shared';
import { useTestDataSource } from './test-utils/sqliteTestDataSource';
import { wrapHandler } from './handlersRegistry';

// Importing handlersRegistry.ts pulls in every domain's handlers (and `ipcMain`), but none
// of that touches Electron or a database until a handler actually runs - so an in-memory
// DataSource is all the setup this needs. `registerAllHandlers()` is the one export that
// does need a real `ipcMain`, and it isn't exercised here.
describe('wrapHandler', () => {
  const channel = noteEndpoints.create.channel;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    ({ teardown } = await useTestDataSource());
  });

  afterAll(async () => {
    await teardown();
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
