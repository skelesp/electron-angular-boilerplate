import { describe, it, expect } from 'vitest';
import { ApiError, ApiErrorCode, apiErrorCodeSchema } from './errors';
import { apiResponseSchema } from './types';
import { z } from 'zod';

describe('apiErrorCodeSchema', () => {
  it('accepts every code in ApiErrorCode', () => {
    for (const code of Object.values(ApiErrorCode)) {
      expect(apiErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it('rejects an HTTP status number, which is what this replaced', () => {
    expect(apiErrorCodeSchema.safeParse(500).success).toBe(false);
  });
});

describe('ApiError', () => {
  it('carries a code alongside the message', () => {
    const error = new ApiError(ApiErrorCode.NOT_FOUND, 'Note not found');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ApiErrorCode.NOT_FOUND);
    expect(error.message).toBe('Note not found');
  });
});

describe('apiResponseSchema', () => {
  const schema = apiResponseSchema(z.strictObject({ id: z.string() }));

  it('accepts a success envelope', () => {
    expect(schema.safeParse({ status: 'success', data: { id: '1' } }).success).toBe(true);
  });

  it('accepts an error envelope carrying a known code', () => {
    const result = schema.safeParse({ status: 'error', error: { code: ApiErrorCode.INTERNAL, details: 'boom' } });
    expect(result.success).toBe(true);
  });
});
