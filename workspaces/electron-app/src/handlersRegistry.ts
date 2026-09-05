import {
  ApiError,
  ApiErrorCode,
  ApiResponse,
  AppApiRegistry,
  EndpointDefinition,
  getEndpointSchemas,
  Handlers,
} from '@electron-angular-boilerplate/shared';
import { ipcMain } from 'electron';
import { isDevBuild } from './env';
import { noteHandlers } from './models/notes/note.handler';
import { getLogger } from './logger';

// Add one spread entry per domain's handlers object here.
export const handlersRegistry: Handlers<AppApiRegistry> = {
  ...noteHandlers,
};

function toErrorResponse(code: ApiErrorCode, details: string): ApiResponse<never> {
  return { status: 'error', error: { code, details } };
}

/**
 * Checks a handler's response against the channel's declared `outputSchema`.
 *
 * Only in development builds, and this asymmetry is deliberate. Every response has
 * already been type-checked at compile time, so this catches the cases types can't:
 * an entity returned where a DTO was declared (and carrying columns the contract never
 * mentions), a `Date` that turned into a string somewhere, a handler that drifted from
 * its schema. Those are bugs to fix before shipping, not conditions to re-check on every
 * IPC call a user makes - so packaged builds skip the parse and pay nothing.
 *
 * The valid response is returned as-is rather than as `parsed.data`: zod would hand back
 * a *copy*, and a validator that quietly rewrites what it validates would make dev and
 * production behave differently in exactly the situation you least want that.
 */
function validateOutput(channel: string, outputSchema: EndpointDefinition['outputSchema'], result: unknown): unknown {
  if (!isDevBuild()) {
    return result;
  }

  const parsed = outputSchema.safeParse(result);
  if (parsed.success) {
    return result;
  }

  getLogger().error(
    `Handler for ${channel} returned a response that violates its output schema:`,
    parsed.error.message
  );
  return toErrorResponse(
    ApiErrorCode.CONTRACT_VIOLATION,
    `Response from ${channel} does not match its declared output schema: ${parsed.error.message}`
  );
}

// Wraps a handler so that every channel gets the same, guaranteed behaviour:
// the raw IPC payload is validated against the channel's zod input schema
// before the handler ever sees it, the response is validated against the output
// schema on the way back out (in development - see validateOutput), and any error
// the handler throws is turned into an ApiResponse error instead of an unhandled
// rejection. Individual handlers stay free of this boilerplate and can just throw.
export function wrapHandler(channel: string, handler: (input: unknown) => Promise<unknown>) {
  const schemas = getEndpointSchemas(channel);

  return async (rawInput: unknown) => {
    if (!schemas) {
      getLogger().error(`No schema registered for channel ${channel}`);
      return toErrorResponse(ApiErrorCode.UNKNOWN_CHANNEL, `No schema registered for channel ${channel}`);
    }

    const parsed = schemas.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return toErrorResponse(ApiErrorCode.VALIDATION_FAILED, parsed.error.message);
    }

    let result: unknown;
    try {
      result = await handler(parsed.data);
    } catch (error) {
      // An ApiError is a documented outcome the handler chose (a missing record, a
      // conflicting write), so it carries its own code and isn't logged as a failure.
      // Anything else is a bug: report it as INTERNAL and log it.
      if (error instanceof ApiError) {
        getLogger().debug(`Channel ${channel} returned ${error.code}: ${error.message}`);
        return toErrorResponse(error.code, error.message);
      }
      getLogger().error(`Error handling channel ${channel}:`, error);
      return toErrorResponse(ApiErrorCode.INTERNAL, error instanceof Error ? error.message : 'Unknown error');
    }

    return validateOutput(channel, schemas.outputSchema, result);
  };
}

// Register IPC handlers with type checking
export const registerAllHandlers = () => {
  Object.entries(handlersRegistry).forEach(([channel, handler]) => {
    if (typeof handler === 'function') {
      // Dispatch is inherently dynamic here (channel -> handler resolved at
      // runtime), so the per-channel input/output typing that Handlers<T>
      // gives each handler can't be preserved through this loop - it's
      // already fully validated against its own schema inside wrapHandler.
      const dynamicHandler = handler as (input: unknown) => Promise<unknown>;
      ipcMain.handle(channel, (_, input) => wrapHandler(channel, dynamicHandler)(input));
    } else {
      getLogger().error(`Invalid handler for channel ${channel}`);
    }
  });
  getLogger().debug(Object.keys(handlersRegistry));
};
