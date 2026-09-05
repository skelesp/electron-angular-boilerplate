import { Migration1788506430536 } from './1788506430536-Migration';

/**
 * Every migration the packaged app runs, listed explicitly - the same deal as the `entities`
 * array in `sqlite.config.ts`, and for a sharper reason.
 *
 * A packaged build's `dist/` lives inside `app.asar`, and TypeORM expands a `migrations` glob
 * with a real filesystem walk, which matches nothing in there. The failure is silent: the
 * DataSource initializes, `migrationsRun` finds zero migrations, and the app starts against an
 * empty database where every query dies with "no such table: note_record". It only shows up on
 * a machine with no database yet, which is why it survived local testing and only broke on
 * fresh CI runners.
 *
 * `data-source.cli.ts` still globs, on purpose: the CLI runs from source, outside any archive,
 * and must pick up a freshly generated migration before anyone has edited this file.
 *
 * Add each new migration here alongside the generated file. Order is irrelevant - TypeORM sorts
 * by the timestamp in the class name - but keeping them in that order reads better.
 */
export const migrations = [Migration1788506430536];
