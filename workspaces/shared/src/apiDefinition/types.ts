import { z, ZodTypeAny } from 'zod';

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
    code: number;
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
 */
export const apiResponseSchema = <TDataSchema extends ZodTypeAny>(
  dataSchema: TDataSchema
) =>
  z.discriminatedUnion('status', [
    z.object({
      status: z.literal('success'),
      data: dataSchema,
      timestamp: z.string().optional(),
      meta: z
        .object({
          totalItems: z.number().optional(),
          page: z.number().optional(),
          pageSize: z.number().optional(),
          totalPages: z.number().optional(),
        })
        .optional(),
    }),
    z.object({
      status: z.literal('error'),
      error: z.object({
        code: z.number(),
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
 */
export interface EndpointDefinition<
  TChannel extends string = string,
  TInputSchema extends ZodTypeAny = ZodTypeAny,
  TOutputSchema extends ZodTypeAny = ZodTypeAny,
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
    z.infer<T[K]['outputSchema']> extends ApiResponse<unknown>
      ? z.infer<T[K]['outputSchema']>
      : never
  >;
};
