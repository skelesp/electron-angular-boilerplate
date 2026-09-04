import { describe, it, expect } from 'vitest';
import { isValidChannel, getEndpointSchemas } from './validation';
import { noteEndpoints } from './note/endpoints';

describe('isValidChannel', () => {
  it('returns true for a channel registered in the api registry', () => {
    expect(isValidChannel(noteEndpoints.create.channel)).toBe(true);
  });

  it('returns false for an unregistered channel', () => {
    expect(isValidChannel('bogus.channel')).toBe(false);
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
