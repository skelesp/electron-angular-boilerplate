import {
  ApiError,
  ApiErrorCode,
  ApiResponse,
  AppApiRegistry,
  getEndpointSchemas,
  Handlers,
} from '@electron-angular-boilerplate/shared';
import { ipcMain } from 'electron';
import { noteHandlers } from './models/notes/note.handler';
import { getLogger } from './logger';

export const notImplemented = () => {
  throw new Error('Not implemented');
};

// Add one spread entry per domain's handlers object here.
export const handlersRegistry: Handlers<AppApiRegistry> = {
  ...noteHandlers,
};

function toErrorResponse(code: ApiErrorCode, details: string): ApiResponse<never> {
  return { status: 'error', error: { code, details } };
}

// Wraps a handler so that every channel gets the same, guaranteed behaviour:
// the raw IPC payload is validated against the channel's zod input schema
// before the handler ever sees it, and any error the handler throws is
// turned into an ApiResponse error instead of an unhandled rejection.
// Individual handlers stay free of this boilerplate and can just throw.
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

    try {
      return await handler(parsed.data);
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
