import { z } from 'zod';

/**
 * IPC is not HTTP. Numeric status codes borrowed from HTTP look familiar but carry
 * assumptions that don't apply here (there is no network, no cache, no proxy) and they
 * force the renderer to discriminate on magic numbers. A closed set of named codes says
 * what actually went wrong, is exhaustively checkable by TypeScript, and reads the same
 * in a log line as it does in a `switch`.
 *
 * Add codes as your domains need them - the schema and the TS union are both derived
 * from this object, so a new entry is one edit.
 */
export const ApiErrorCode = {
  /** The payload failed its channel's zod input schema. Nothing ran. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** The channel isn't in the registry, so there is no schema to validate against. */
  UNKNOWN_CHANNEL: 'UNKNOWN_CHANNEL',
  /** The request was well-formed but the thing it names doesn't exist. */
  NOT_FOUND: 'NOT_FOUND',
  /** The request conflicts with current state (a duplicate, a stale write). */
  CONFLICT: 'CONFLICT',
  /** The caller isn't allowed to do this. */
  FORBIDDEN: 'FORBIDDEN',
  /**
   * The handler produced a response that doesn't match its own declared output schema.
   * Only ever returned by development builds, where outputs are validated - see
   * electron-app's `wrapHandler`.
   */
  CONTRACT_VIOLATION: 'CONTRACT_VIOLATION',
  /** Anything else: an unexpected throw inside a handler. */
  INTERNAL: 'INTERNAL',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const apiErrorCodeSchema = z.enum(ApiErrorCode);

/**
 * Throw this from a handler to choose the error code the renderer sees. Any other thrown
 * value is reported as `INTERNAL`, so handlers only need it for errors that are part of
 * the contract (a missing record, a conflicting write) rather than a bug.
 *
 * The `message` crosses the IPC boundary as `error.details`; keep it free of anything you
 * wouldn't show a user.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
