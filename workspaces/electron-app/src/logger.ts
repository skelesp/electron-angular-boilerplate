import { app } from 'electron';
import log from 'electron-log/main';

log.transports.console.level = app.isPackaged ? 'info' : 'debug';
log.transports.file.level = app.isPackaged ? 'info' : false;

export const logger = log;
