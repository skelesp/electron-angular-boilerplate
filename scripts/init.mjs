#!/usr/bin/env node
// Turns this template into a project of its own: rewrites the product name, the npm scope the
// workspaces import each other by, the electron-builder appId, the SQLite filename, the LICENSE
// holder and the readme, in place.
//
// It exists because each of those is a plain string living in more than one file - the shared
// package's scope alone appears about twenty times across three workspaces, the lockfile and
// CLAUDE.md - so renaming by hand is both tedious and easy to do incompletely, and a
// half-renamed monorepo fails at `import`, which is a worse place to find out.
//
// Runs on plain Node with no dependencies, deliberately: renaming `@<scope>/shared` invalidates
// the workspace symlink a previous `npm install` created, so the intended order is
// `npm run init` first, `npm install` second.
//
// Usage:
//   npm run init                                   interactive
//   npm run init -- --name "Acme Notes" --yes      non-interactive (scripted forks, CI)
//   npm run init -- --name "Acme Notes" --dry-run  report what would change, write nothing
//
// Flags: --name, --scope, --app-id, --author, --description, --database, --repo, --yes, --dry-run,
//        --force (re-run against an already-initialized checkout), --help.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// This file is the one place the placeholders below are *supposed* to appear verbatim, so the
// walk skips it. Rewriting them here would substitute the script's own constants, leaving it
// unable to recognise (or undo) what it had already done.
const selfPath = fileURLToPath(import.meta.url);

// The identity this template ships with. Everything a consumer would otherwise have to hunt
// down by hand is one of these strings; keep this object and buildSubstitutions() in step.
const PLACEHOLDER = {
  scope: 'electron-angular-boilerplate',
  productName: 'Electron Angular Boilerplate',
  appId: 'com.electronangularboilerplate.app',
  databaseFile: 'boilerplate.sqlite',
  // The GitHub repository this template lives in, and its owner. These appear in the readme's
  // badges, the homepage/bugs links in package.json, CODEOWNERS, SECURITY.md and the issue
  // templates - all of which would otherwise point a consumer's project at *this* repo, which
  // is worse than pointing nowhere: a green badge for someone else's CI runs.
  repositorySlug: 'skelesp/electron-angular-boilerplate',
  repositoryOwner: 'skelesp',
  licenseHolder: /^Copyright \(c\) .*$/m,
};

// Directories that are either build output, caches, or not ours to rewrite (.git's object
// store, and .claude, which holds the template author's local editor permissions).
const SKIP_DIRECTORIES = new Set([
  '.angular',
  '.claude',
  '.git',
  '.history',
  'coverage',
  'data',
  'dist',
  'node_modules',
  'playwright-report',
  'release',
  'renderer',
  'test-results',
]);

// An allowlist rather than a "is this file binary?" sniff: every occurrence of the template's
// identity is text with one of these extensions, and an allowlist cannot corrupt an icon, a
// prebuilt .node addon or a SQLite file by guessing wrong.
const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.txt',
  '.yaml',
  '.yml',
]);

// Extension-less files that still carry the template's identity. `.github/CODEOWNERS` names the
// repository owner, and an extension-based allowlist alone would silently leave a consumer's
// pull requests requesting review from this template's author.
const TEXT_FILENAMES = new Set(['CODEOWNERS']);

// Blocks of the readme that only make sense while the repo *is* the template. Stripped on init
// rather than hand-deleted, so the readme a consumer keeps is about their app. The trailing
// blank lines are part of the match: leaving them behind would hand a freshly initialized
// checkout a `npm run format:check` failure on its very first run.
const TEMPLATE_ONLY_BLOCK =
  /^[ \t]*<!-- template-only:start -->[\s\S]*?<!-- template-only:end -->[ \t]*\r?\n(?:[ \t]*\r?\n)*/gm;

const BOOLEAN_FLAGS = ['yes', 'dry-run', 'force', 'help'];
const VALUE_FLAGS = ['name', 'scope', 'app-id', 'author', 'description', 'database', 'repo'];

const USAGE = `Rewrites this template's name, npm scope, appId and license into your own.

  npm run init                                   interactive
  npm run init -- --name "Acme Notes" --yes      non-interactive
  npm run init -- --name "Acme Notes" --dry-run  report changes, write nothing

  --name <text>         product name shown in the window, menus and installer
  --scope <slug>        npm scope and root package name (default: slugified --name)
  --app-id <id>         electron-builder appId (default: com.<scope>.app)
  --author <name>       package.json author and LICENSE copyright holder
  --description <text>  package.json description
  --database <file>     SQLite filename (default: <scope>.sqlite)
  --repo <owner/name>   GitHub repository for badges and links (default: the origin remote)
  --yes                 skip the confirmation prompt
  --dry-run             report what would change without writing
  --force               run again on an already-initialized checkout
  --help                this message`;

function parseArgs(argv) {
  const flags = { yes: false, 'dry-run': false, force: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument "${arg}". Run with --help for usage.`);
    }

    const [key, inlineValue] = arg.slice(2).split(/=(.*)/s);
    if (BOOLEAN_FLAGS.includes(key)) {
      flags[key] = true;
      continue;
    }
    if (!VALUE_FLAGS.includes(key)) {
      throw new Error(`Unknown flag "--${key}". Run with --help for usage.`);
    }

    // A missing value would otherwise swallow the next flag - `--name --yes` silently naming
    // the app "--yes" - and the resulting rename is spread across thirty files by the time
    // anyone notices.
    const value = inlineValue ?? argv[(i += 1)];
    if (value === undefined || (inlineValue === undefined && value.startsWith('--'))) {
      throw new Error(`Flag "--${key}" needs a value.`);
    }
    flags[key] = value;
  }

  return flags;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleize(value) {
  return value
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function gitConfiguredAuthor() {
  try {
    return execFileSync('git', ['config', 'user.name'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// A repo made with "Use this template" already has its own `origin` before anyone runs this
// script, so the remote is a better default than any prompt - and the only one that is right
// without being told. Both URL forms GitHub hands out are accepted; anything else (no remote,
// a non-GitHub host, a bare local clone) falls back to an empty default and the placeholder is
// left in place with a warning, which is the honest outcome.
function gitOriginRepositorySlug() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const match = /^(?:https?:\/\/[^/]+\/|git@[^:]+:|ssh:\/\/git@[^/]+\/)([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

// npm's own package-name rules, minus the ones a scope cannot hit anyway. Checked here because
// a bad scope surfaces as an `npm install` failure a dozen files later, with no hint that this
// script is what wrote it.
function validateScope(scope) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(scope) || scope.length > 214) {
    return 'must be lowercase, start with a letter or digit, and contain only letters, digits, "-", "_" or "."';
  }
  return null;
}

function validateAppId(appId) {
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(appId)) {
    return 'must be reverse-DNS, for example com.example.acme-notes';
  }
  return null;
}

// The product name is substituted verbatim into contexts with their own escaping rules - a
// single-quoted TypeScript string in app.component.ts, an HTML <title>, a raw JSON string in
// package.json - so a name carrying one of their delimiters would produce a syntax error in
// a file the consumer never opened. Rejecting the handful of characters that can do that is
// cheaper, and far easier to explain, than making the substitution context-aware.
function validateProductName(name) {
  if (name.trim().length === 0) return 'cannot be empty';
  if (name.includes('\n')) return 'must be a single line';
  if (/["'`\\<>&]/.test(name)) return 'cannot contain quotes, backslashes, angle brackets or "&"';
  return null;
}

function validateDatabaseFile(file) {
  if (!/^[A-Za-z0-9._-]+$/.test(file)) return 'must be a bare filename, with no path separators';
  return null;
}

// GitHub's own rules for an owner and a repository name. Substituted into URLs, a CODEOWNERS
// entry and package.json, so a stray space or slash would break all three at once.
function validateRepositorySlug(slug) {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/[A-Za-z0-9._-]{1,100}$/.test(slug)) {
    return 'must be "owner/name", for example acme/acme-notes';
  }
  return null;
}

function* walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) yield* walk(path);
    } else if (
      entry.isFile() &&
      (TEXT_EXTENSIONS.has(extname(entry.name)) || TEXT_FILENAMES.has(entry.name)) &&
      path !== selfPath
    ) {
      yield path;
    }
  }
}

// Ordered longest-match-first so a scope that differs from the package name cannot leave a
// half-rewritten identifier behind: "@<scope>/shared" contains the bare scope.
function buildSubstitutions(answers) {
  // An unanswered repository (no origin remote, or a non-GitHub one) leaves the placeholder
  // alone rather than substituting an empty string, which would silently delete the owner out
  // of every URL it appears in.
  const repository = answers.repositorySlug
    ? [
        // First, before anything that could rewrite half of it: the slug contains the scope.
        [PLACEHOLDER.repositorySlug, answers.repositorySlug],
      ]
    : [];
  const repositoryOwner = answers.repositorySlug
    ? [
        // Last: mentions of the owner on its own that the slug pass didn't cover - the
        // CODEOWNERS handle, and the profile links in CODE_OF_CONDUCT.md.
        [PLACEHOLDER.repositoryOwner, repositoryOwnerOf(answers.repositorySlug)],
      ]
    : [];

  return [
    ...repository,
    [`@${PLACEHOLDER.scope}/`, `@${answers.scope}/`],
    [PLACEHOLDER.appId, answers.appId],
    [PLACEHOLDER.productName, answers.productName],
    [PLACEHOLDER.databaseFile, answers.databaseFile],
    [PLACEHOLDER.scope, answers.scope],
    ...repositoryOwner,
  ];
}

function repositoryOwnerOf(slug) {
  return slug.split('/')[0];
}

function countPlaceholders() {
  let total = 0;

  for (const file of walk(repoRoot)) {
    const contents = readFileSync(file, 'utf8');
    total += contents.split(PLACEHOLDER.scope).length - 1;
    total += contents.split(PLACEHOLDER.productName).length - 1;
  }

  return total;
}

// Every plan* function below collects writes into `edits` rather than writing as it goes, so
// --dry-run and the confirmation prompt can report exactly what a real run would do. Later
// passes read through `edits` so they build on earlier ones instead of clobbering them.
function planTokenRewrites(answers, edits) {
  const substitutions = buildSubstitutions(answers).filter(([from, to]) => from !== to);

  for (const file of walk(repoRoot)) {
    const original = readFileSync(file, 'utf8');
    let updated = original;

    for (const [from, to] of substitutions) {
      updated = updated.replaceAll(from, to);
    }

    if (updated !== original) edits.set(file, updated);
  }
}

function planJsonRewrites(answers, edits) {
  const patch = (relativePath, mutate) => {
    const path = join(repoRoot, relativePath);
    const json = JSON.parse(edits.get(path) ?? readFileSync(path, 'utf8'));
    mutate(json);
    // package.json files are Prettier-formatted, and Prettier's JSON output is exactly
    // two-space JSON.stringify plus a trailing newline - so this stays format:check-clean.
    edits.set(path, `${JSON.stringify(json, null, 2)}\n`);
  };

  patch('package.json', (json) => {
    json.description = answers.description;
    json.keywords = ['electron', 'angular', 'sqlite', 'desktop'];
    json.author = answers.author;
  });

  for (const workspace of ['shared', 'electron-app']) {
    patch(`workspaces/${workspace}/package.json`, (json) => {
      json.description = `${answers.productName} - ${workspace} workspace.`;
      json.author = answers.author;
    });
  }
}

function planLicenseRewrite(answers, edits, warnings) {
  const path = join(repoRoot, 'LICENSE');
  if (!existsSync(path)) return;

  if (answers.author.length === 0) {
    warnings.push('LICENSE left unchanged - no author given. Edit the copyright line by hand.');
    return;
  }

  const original = readFileSync(path, 'utf8');

  // Tested against the source rather than inferred from "the replace changed nothing", because
  // those are two different outcomes: a LICENSE whose copyright line already names this author
  // in this year is *correct*, and reporting it as a file with no copyright line sent anyone
  // re-running init - or initializing a fork of an already-initialized project - to go check a
  // file that needs nothing.
  if (!PLACEHOLDER.licenseHolder.test(original)) {
    warnings.push('LICENSE has no "Copyright (c) ..." line to rewrite - check it by hand.');
    return;
  }

  const updated = original.replace(
    PLACEHOLDER.licenseHolder,
    `Copyright (c) ${new Date().getFullYear()} ${answers.author}`
  );

  if (updated !== original) edits.set(path, updated);
}

function planReadmeRewrite(answers, edits) {
  // Must match the file's real name, not just a case-insensitive hit on it: `edits` is keyed by
  // path, so a "readme.md" key here would sit alongside the walk's "README.md" key and the two
  // would write the same file twice, in Map order, with the token pass losing.
  const path = join(repoRoot, 'README.md');
  if (!existsSync(path)) return;

  const original = edits.get(path) ?? readFileSync(path, 'utf8');
  const updated = original.replace(TEMPLATE_ONLY_BLOCK, '').replace(/^# .*$/m, `# ${answers.productName}`);

  if (updated !== original) edits.set(path, updated);
}

async function promptAnswers(flags) {
  const interactive = Boolean(stdin.isTTY) && !flags.yes;
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

  const ask = async (label, { flag, fallback = '', validate = () => null, required = false }) => {
    let value = flags[flag];

    for (;;) {
      if (value === undefined) {
        if (rl === null) {
          if (required && fallback.length === 0) {
            throw new Error(`--${flag} is required when running non-interactively.`);
          }
          value = fallback;
        } else {
          const suffix = fallback.length > 0 ? ` [${fallback}]` : '';
          value = (await rl.question(`${label}${suffix}: `)).trim() || fallback;
        }
      }

      const problem = value.length === 0 && !required ? null : validate(value);
      if (problem === null) return value;

      if (rl === null) throw new Error(`--${flag} ${problem}`);
      stdout.write(`  ${label} ${problem}\n`);
      value = undefined;
    }
  };

  try {
    // A fresh "Use this template" checkout is usually already named after the project, so the
    // directory name is a better first guess than anything derived from the template itself -
    // and when it is still the template's own name it is no guess at all, so the prompt is
    // deliberately left without a default.
    const directoryName = titleize(basename(repoRoot));
    const productName = await ask('Product name', {
      flag: 'name',
      fallback: directoryName === PLACEHOLDER.productName ? '' : directoryName,
      validate: validateProductName,
      required: true,
    });

    const scope = await ask('npm scope and package name', {
      flag: 'scope',
      fallback: slugify(productName),
      validate: validateScope,
      required: true,
    });

    const appId = await ask('Application id', {
      flag: 'app-id',
      fallback: `com.${scope.replace(/[^a-z0-9]/g, '')}.app`,
      validate: validateAppId,
      required: true,
    });

    const author = await ask('Author (package.json, LICENSE)', {
      flag: 'author',
      fallback: gitConfiguredAuthor(),
    });

    const description = await ask('Description', {
      flag: 'description',
      fallback: `${productName.trim()} - an Electron and Angular desktop application.`,
    });

    const databaseFile = await ask('SQLite filename', {
      flag: 'database',
      fallback: `${scope}.sqlite`,
      validate: validateDatabaseFile,
      required: true,
    });

    const repositorySlug = await ask('GitHub repository (owner/name)', {
      flag: 'repo',
      fallback: gitOriginRepositorySlug(),
      validate: validateRepositorySlug,
    });

    const answers = {
      productName: productName.trim(),
      scope,
      appId,
      author: author.trim(),
      description: description.trim(),
      databaseFile,
      repositorySlug: repositorySlug.trim(),
    };

    // Printed on every run, not just interactive ones: a non-interactive run takes defaults for
    // whatever was not passed as a flag, so this is the only record of what it decided.
    stdout.write(
      [
        '',
        `  Product name    ${answers.productName}`,
        `  Package name    ${answers.scope}`,
        `  Shared package  @${answers.scope}/shared`,
        `  Application id  ${answers.appId}`,
        `  Author          ${answers.author || '(left unchanged)'}`,
        `  Description     ${answers.description}`,
        `  SQLite file     ${answers.databaseFile}`,
        `  Repository      ${answers.repositorySlug || '(left unchanged)'}`,
        '',
      ].join('\n')
    );

    if (rl !== null) {
      const confirmed = (await rl.question('Write these changes? [Y/n] ')).trim().toLowerCase();
      if (confirmed.length > 0 && !confirmed.startsWith('y')) {
        throw new Error('Cancelled - nothing was written.');
      }
    }

    return answers;
  } finally {
    rl?.close();
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    stdout.write(`${USAGE}\n`);
    return;
  }

  if (countPlaceholders() === 0 && !flags.force) {
    stdout.write('This checkout has already been initialized - nothing to rename. Re-run with --force to override.\n');
    return;
  }

  const answers = await promptAnswers(flags);

  const edits = new Map();
  const warnings = [];
  if (answers.repositorySlug.length === 0) {
    warnings.push(
      'Repository left unchanged - no GitHub "origin" remote to read it from. Fix the badges in ' +
        'README.md, the homepage/bugs links in package.json and the handle in .github/CODEOWNERS by hand.'
    );
  }
  planTokenRewrites(answers, edits);
  planJsonRewrites(answers, edits);
  planLicenseRewrite(answers, edits, warnings);
  planReadmeRewrite(answers, edits);

  const paths = [...edits.keys()].sort();

  if (flags['dry-run']) {
    stdout.write(`\nWould update ${paths.length} file(s):\n`);
    for (const path of paths) {
      stdout.write(`  ${relative(repoRoot, path).replaceAll('\\', '/')}\n`);
    }
  } else {
    for (const [path, contents] of edits) writeFileSync(path, contents);
    stdout.write(`\nUpdated ${paths.length} file(s).\n`);
  }

  for (const warning of warnings) {
    stdout.write(`  warning: ${warning}\n`);
  }

  if (flags['dry-run']) return;

  // An existing node_modules still has @<old scope>/shared symlinked into it, pointing at a
  // package name that no longer exists - nothing resolves until npm relinks the workspaces.
  const relink = existsSync(join(repoRoot, 'node_modules'))
    ? `   # required: relinks the renamed @${answers.scope}/shared workspace`
    : '';

  stdout.write(
    [
      '',
      'Next steps:',
      `  npm install${relink}`,
      '  npm start',
      '',
      "Then review README.md. The section that showed screenshots of the template's own example",
      'app is gone, so .github/assets/ is now unreferenced - delete it, or put your own shots',
      'there. Delete scripts/init.mjs and the "init" script in package.json when you no longer',
      'need them.',
      '',
    ].join('\n')
  );
}

main().catch((error) => {
  process.exitCode = 1;
  stdout.write(`\n${error.message}\n`);
});
