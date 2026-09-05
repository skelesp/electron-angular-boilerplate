import log from 'electron-log/main';
import { isPackagedBuild } from './env';

let configured = false;

/**
 * The application logger, configured on first use rather than at module load. See env.ts
 * for why the `app.isPackaged` read has to be lazy; the practical payoff is that any
 * module can `import { getLogger }` and still be unit-testable without mocking `electron`.
 */
export function getLogger(): typeof log {
  if (!configured) {
    configured = true;
    const packaged = isPackagedBuild();
    log.transports.console.level = packaged ? 'info' : 'debug';
    log.transports.file.level = packaged ? 'info' : false;
  }
  return log;
}
