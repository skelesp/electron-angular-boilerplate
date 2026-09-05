import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ApiError, ApiErrorCode, noteEndpoints } from '@electron-angular-boilerplate/shared';
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

  it('returns a VALIDATION_FAILED envelope without calling the handler when input fails validation', async () => {
    const handler = vi.fn();
    const wrapped = wrapHandler(channel, handler);

    const result = await wrapped({ title: '' /* missing content, empty title */ });

    expect(result).toMatchObject({ status: 'error', error: { code: ApiErrorCode.VALIDATION_FAILED } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns an INTERNAL envelope when the handler throws something unexpected', async () => {
    const wrapped = wrapHandler(channel, async () => {
      throw new Error('boom');
    });

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(result).toEqual({ status: 'error', error: { code: ApiErrorCode.INTERNAL, details: 'boom' } });
  });

  it('carries the code an ApiError chose through to the renderer', async () => {
    const wrapped = wrapHandler(channel, async () => {
      throw new ApiError(ApiErrorCode.NOT_FOUND, 'Note not found');
    });

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(result).toEqual({ status: 'error', error: { code: ApiErrorCode.NOT_FOUND, details: 'Note not found' } });
  });

  it('returns an UNKNOWN_CHANNEL envelope for a channel that is not in the registry', async () => {
    const handler = vi.fn();

    const result = await wrapHandler('not.a.channel', handler)({});

    expect(result).toMatchObject({ status: 'error', error: { code: ApiErrorCode.UNKNOWN_CHANNEL } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes validated input through and returns the handler result unchanged for valid input', async () => {
    const now = new Date();
    const fakeResult = {
      status: 'success' as const,
      data: { id: '1', title: 'ok', content: 'ok', createdAt: now, updatedAt: now },
    };
    const handler = vi.fn().mockResolvedValue(fakeResult);
    const wrapped = wrapHandler(channel, handler);

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(handler).toHaveBeenCalledWith({ title: 'ok', content: 'ok' });
    // Returned by identity, not re-parsed into a copy - see validateOutput.
    expect(result).toBe(fakeResult);
  });

  it('rejects a response that omits a field its output schema declares', async () => {
    const wrapped = wrapHandler(channel, async () => ({ status: 'success', data: { id: '1' } }));

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(result).toMatchObject({ status: 'error', error: { code: ApiErrorCode.CONTRACT_VIOLATION } });
  });

  // The reason output validation exists: a handler returning its TypeORM entity instead of
  // a DTO type-checks for as long as the two shapes agree, and silently starts leaking the
  // moment a column is added. Strict output DTOs turn that into a caught failure.
  it('rejects a response carrying a field the output DTO never declared', async () => {
    const now = new Date();
    const wrapped = wrapHandler(channel, async () => ({
      status: 'success',
      data: { id: '1', title: 'ok', content: 'ok', createdAt: now, updatedAt: now, internalNotes: 'leaked' },
    }));

    const result = await wrapped({ title: 'ok', content: 'ok' });

    expect(result).toMatchObject({ status: 'error', error: { code: ApiErrorCode.CONTRACT_VIOLATION } });
    if (result && typeof result === 'object' && 'error' in result) {
      expect(JSON.stringify(result)).toContain('internalNotes');
    }
  });
});
