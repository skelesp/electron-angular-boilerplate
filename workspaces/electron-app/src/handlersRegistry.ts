import { AppApiRegistry, Handlers, getEndpointSchemas, ApiResponse } from '@electron-angular-boilerplate/shared';
import { ipcMain } from 'electron';
import { noteHandlers } from './models/notes/note.handler';
import { logger } from './logger';

export const notImplemented = () => {
  throw new Error('Not implemented');
};

// Add one spread entry per domain's handlers object here.
export const handlersRegistry: Handlers<AppApiRegistry> = {
  ...noteHandlers,
};

function toErrorResponse(code: number, details: string): ApiResponse<never> {
  return { status: 'error', error: { code, details } };
}

// Wraps a handler so that every channel gets the same, guaranteed behaviour:
// the raw IPC payload is validated against the channel's zod input schema
// before the handler ever sees it, and any error the handler throws is
// turned into an ApiResponse error instead of an unhandled rejection.
// Individual handlers stay free of this boilerplate and can just throw.
function wrapHandler(channel: string, handler: (input: unknown) => Promise<unknown>) {
  const schemas = getEndpointSchemas(channel);

  return async (rawInput: unknown) => {
    if (!schemas) {
      logger.error(`No schema registered for channel ${channel}`);
      return toErrorResponse(500, `No schema registered for channel ${channel}`);
    }

    const parsed = schemas.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return toErrorResponse(400, parsed.error.message);
    }

    try {
      return await handler(parsed.data);
    } catch (error) {
      logger.error(`Error handling channel ${channel}:`, error);
      return toErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
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
      logger.error(`Invalid handler for channel ${channel}`);
    }
  });
  logger.debug(Object.keys(handlersRegistry));
};
