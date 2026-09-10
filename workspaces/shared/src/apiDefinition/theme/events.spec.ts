import { describe, it, expect } from 'vitest';
import { themeEvents } from './events.js';
import { ThemeStateSchema } from './types.js';

describe('theme events', () => {
  it('names its channel under the domain prefix', () => {
    expect(themeEvents.changed.channel).toBe('theme.changed');
  });

  it('accepts a valid theme state', () => {
    expect(ThemeStateSchema.safeParse({ source: 'system', shouldUseDarkColors: true }).success).toBe(true);
  });

  it('rejects an unknown source', () => {
    expect(ThemeStateSchema.safeParse({ source: 'sepia', shouldUseDarkColors: false }).success).toBe(false);
  });

  it('rejects extra fields, so a payload can never carry more than the contract says', () => {
    expect(ThemeStateSchema.safeParse({ source: 'dark', shouldUseDarkColors: true, accentColor: '#f00' }).success).toBe(
      false
    );
  });
});
