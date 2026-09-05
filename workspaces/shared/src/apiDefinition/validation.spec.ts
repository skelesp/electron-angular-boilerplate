import { describe, it, expect } from 'vitest';
import { getEndpointSchemas, getEventSchema, isValidChannel, isValidEventChannel } from './validation';
import { noteEndpoints } from './note/endpoints';
import { noteEvents } from './note/events';

describe('isValidChannel', () => {
  it('returns true for a channel registered in the api registry', () => {
    expect(isValidChannel(noteEndpoints.create.channel)).toBe(true);
  });

  it('returns false for an unregistered channel', () => {
    expect(isValidChannel('bogus.channel')).toBe(false);
  });

  it('returns false for an event channel, which is not invokable', () => {
    expect(isValidChannel(noteEvents.changed.channel)).toBe(false);
  });
});

describe('getEndpointSchemas', () => {
  it('returns the endpoint definition for a registered channel', () => {
    expect(getEndpointSchemas(noteEndpoints.create.channel)).toBe(noteEndpoints.create);
  });

  it('returns undefined for an unregistered channel', () => {
    expect(getEndpointSchemas('bogus.channel')).toBeUndefined();
  });
});

describe('isValidEventChannel', () => {
  it('returns true for a channel registered in the event registry', () => {
    expect(isValidEventChannel(noteEvents.changed.channel)).toBe(true);
  });

  it('returns false for a request/response channel, which is not subscribable', () => {
    expect(isValidEventChannel(noteEndpoints.create.channel)).toBe(false);
  });
});

describe('getEventSchema', () => {
  it('returns the payload schema for a registered event channel', () => {
    expect(getEventSchema(noteEvents.changed.channel)).toBe(noteEvents.changed.payloadSchema);
  });

  it('returns undefined for an unregistered event channel', () => {
    expect(getEventSchema('bogus.channel')).toBeUndefined();
  });
});
