import { describe, it, expect } from 'vitest';
import { GetThemeInputSchema, SetThemeSourceInputSchema, SetThemeSourceOutputSchema } from './types.js';

describe('theme schemas', () => {
  it('takes no input for a get', () => {
    expect(GetThemeInputSchema.safeParse(undefined).success).toBe(true);
    expect(GetThemeInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts each of the three sources', () => {
    for (const source of ['system', 'light', 'dark']) {
      expect(SetThemeSourceInputSchema.safeParse({ source }).success).toBe(true);
    }
  });

  it('rejects a source outside the enum', () => {
    expect(SetThemeSourceInputSchema.safeParse({ source: 'auto' }).success).toBe(false);
  });

  it('wraps the resolved state in the standard envelope', () => {
    const parsed = SetThemeSourceOutputSchema.safeParse({
      status: 'success',
      data: { source: 'dark', shouldUseDarkColors: true },
    });
    expect(parsed.success).toBe(true);
  });
});
