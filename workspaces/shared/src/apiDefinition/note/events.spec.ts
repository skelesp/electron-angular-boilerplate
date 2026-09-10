import { describe, it, expect } from 'vitest';
import { NoteChangedPayloadSchema, noteEvents } from './events.js';

describe('note events', () => {
  it('names its channel under the domain prefix', () => {
    expect(noteEvents.changed.channel).toBe('note.changed');
  });

  it('accepts a valid changed payload', () => {
    expect(NoteChangedPayloadSchema.safeParse({ reason: 'created', id: 'abc' }).success).toBe(true);
  });

  it('rejects an unknown reason', () => {
    expect(NoteChangedPayloadSchema.safeParse({ reason: 'exploded', id: 'abc' }).success).toBe(false);
  });

  it('rejects extra fields, so a payload can never carry more than the contract says', () => {
    expect(NoteChangedPayloadSchema.safeParse({ reason: 'created', id: 'abc', note: {} }).success).toBe(false);
  });
});
