import { z } from 'zod';
import { ApiErrorCode, apiErrorCodeSchema } from './errors.js';

interface BaseApiResponse {
  status: 'success' | 'error';
  timestamp?: string; // ISO 8601 timestamp of the response generation
}

interface SuccessResponse<T> extends BaseApiResponse {
  status: 'success';
  data: T;
  meta?: {
    totalItems?: number; // Total number of items in the collection (optional)
    page?: number; // Current page number (optional)
    pageSize?: number; // Number of items per page (optional)
    totalPages?: number; // Total number of pages (optional)
  };
}

interface ErrorResponse extends BaseApiResponse {
  status: 'error';
  error: {
    code: ApiErrorCode;
    details: string;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export type ApiEndpoint<TInput, TOutput extends ApiResponse<unknown>> = {
  input: TInput;
  output: TOutput;
};

export type ApiRegistry = {
  [K: string]: ApiEndpoint<unknown, ApiResponse<unknown>>;
};

export type Handlers<T extends ApiRegistry> = {
  [K in keyof T]: (input: T[K]['input']) => Promise<T[K]['output']>;
};

/**
 * Zod schema for the ApiResponse<T> envelope, parameterized over the schema
 * of the success payload. This is the single source of truth: the runtime
 * validator and the TS type (via z.infer) are derived from the same definition.
 *
 * Both branches are `strictObject`s so that an envelope carrying a field the contract
 * never declared fails validation instead of being silently accepted (or, worse, quietly
 * stripped on one side of the boundary and not the other).
 */
export const apiResponseSchema = <TDataSchema extends z.ZodType>(dataSchema: TDataSchema) =>
  z.discriminatedUnion('status', [
    z.strictObject({
      status: z.literal('success'),
      data: dataSchema,
      timestamp: z.string().optional(),
      meta: z
        .strictObject({
          totalItems: z.number().optional(),
          page: z.number().optional(),
          pageSize: z.number().optional(),
          totalPages: z.number().optional(),
        })
        .optional(),
    }),
    z.strictObject({
      status: z.literal('error'),
      error: z.strictObject({
        code: apiErrorCodeSchema,
        details: z.string(),
      }),
      timestamp: z.string().optional(),
    }),
  ]);

/**
 * An endpoint definition carries its own zod schemas, so the same object is
 * usable both to validate a payload at runtime (schema.parse) and to derive
 * its TS type at compile time (z.infer) - there is no separate hand-written
 * type to keep in sync.
 *
 * `outputSchema` is not decoration: electron-app's `wrapHandler` parses every response
 * against it in development builds, so a handler that drifts from its own contract fails
 * loudly at the boundary rather than shipping whatever object it happened to have.
 */
export interface EndpointDefinition<
  TChannel extends string = string,
  TInputSchema extends z.ZodType = z.ZodType,
  TOutputSchema extends z.ZodType = z.ZodType,
> {
  channel: TChannel;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
}

/**
 * Builds an ApiRegistry-shaped type (channel -> {input, output}) from a
 * const object of EndpointDefinitions, inferring input/output from their
 * zod schemas.
 */
export type InferEndpoints<T extends Record<string, EndpointDefinition>> = {
  [K in keyof T as T[K]['channel']]: ApiEndpoint<
    z.infer<T[K]['inputSchema']>,
    z.infer<T[K]['outputSchema']> extends ApiResponse<unknown> ? z.infer<T[K]['outputSchema']> : never
  >;
};

/**
 * The other half of Electron IPC: messages the main process pushes to the renderer
 * (`webContents.send`) rather than answers to something the renderer asked for. Progress
 * ticks, file-watcher notifications, "the data you're showing just changed elsewhere".
 *
 * They are one-way and have no response, so an event definition carries a single payload
 * schema instead of an input/output pair. Everything else works the same way: the channel
 * name and the payload type both come from this object, and the payload is validated
 * against the schema before it is sent.
 */
export interface EventDefinition<TChannel extends string = string, TPayloadSchema extends z.ZodType = z.ZodType> {
  channel: TChannel;
  payloadSchema: TPayloadSchema;
}

export type ApiEventRegistry = {
  [K: string]: unknown;
};

/** Builds a channel -> payload type map from a const object of EventDefinitions. */
export type InferEvents<T extends Record<string, EventDefinition>> = {
  [K in keyof T as T[K]['channel']]: z.infer<T[K]['payloadSchema']>;
};

/** Unsubscribes a listener registered with `ElectronAPI.on`. */
export type Unsubscribe = () => void;
