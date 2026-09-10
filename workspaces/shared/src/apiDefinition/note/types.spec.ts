import { describe, it, expect } from 'vitest';
import { CreateNoteInputSchema, GetNoteInputSchema, DeleteNoteInputSchema } from './types.js';

describe('CreateNoteInputSchema', () => {
  it('accepts a valid title and content', () => {
    const result = CreateNoteInputSchema.safeParse({ title: 'Groceries', content: 'Milk, eggs' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = CreateNoteInputSchema.safeParse({ title: '', content: 'Milk, eggs' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing content field', () => {
    const result = CreateNoteInputSchema.safeParse({ title: 'Groceries' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (schema is a z.strictObject)', () => {
    const result = CreateNoteInputSchema.safeParse({
      title: 'Groceries',
      content: 'Milk, eggs',
      extra: 'not allowed',
    });
    expect(result.success).toBe(false);
  });
});

describe('GetNoteInputSchema', () => {
  it('accepts a valid id', () => {
    expect(GetNoteInputSchema.safeParse({ id: 'abc-123' }).success).toBe(true);
  });

  it('rejects a missing id', () => {
    expect(GetNoteInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('DeleteNoteInputSchema', () => {
  it('accepts a valid id', () => {
    expect(DeleteNoteInputSchema.safeParse({ id: 'abc-123' }).success).toBe(true);
  });

  it('rejects a non-string id', () => {
    expect(DeleteNoteInputSchema.safeParse({ id: 123 }).success).toBe(false);
  });
});
