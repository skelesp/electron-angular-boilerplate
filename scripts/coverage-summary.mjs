// Renders the per-workspace coverage totals produced by `npm run test:coverage` as a markdown
// table, and appends it to $GITHUB_STEP_SUMMARY when running in GitHub Actions (otherwise just
// prints it). Deliberately reads the `json-summary` files each workspace already writes rather
// than uploading to a coverage service: a template should give a fork useful coverage feedback
// on day one, and every hosted service needs an account and a repo secret first. To add one
// later, point it at the `lcov.info` files the same run produces (see CLAUDE.md).
import { existsSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaces = ['shared', 'electron-app', 'angular-app'];

const pct = (value) => (typeof value === 'number' ? `${value.toFixed(1)}%` : '-');

// Vitest writes coverage/coverage-summary.json; Angular's builder nests it one level deeper,
// under the project name (coverage/<project>/coverage-summary.json). Look in both rather than
// hard-coding either, so renaming the Angular project doesn't quietly blank out this table.
function findSummaryFile(workspace) {
  const coverageDir = join(repoRoot, 'workspaces', workspace, 'coverage');

  if (!existsSync(coverageDir)) {
    return null;
  }

  const direct = join(coverageDir, 'coverage-summary.json');
  if (existsSync(direct)) {
    return direct;
  }

  for (const entry of readdirSync(coverageDir, { withFileTypes: true })) {
    const nested = join(coverageDir, entry.name, 'coverage-summary.json');
    if (entry.isDirectory() && existsSync(nested)) {
      return nested;
    }
  }

  return null;
}

const rows = workspaces.map((workspace) => {
  const summaryFile = findSummaryFile(workspace);

  if (summaryFile === null) {
    return `| ${workspace} | - | - | - | - |`;
  }

  const { total } = JSON.parse(readFileSync(summaryFile, 'utf8'));
  return [
    `| ${workspace}`,
    pct(total.statements?.pct),
    pct(total.branches?.pct),
    pct(total.functions?.pct),
    `${pct(total.lines?.pct)} |`,
  ].join(' | ');
});

const table = [
  '## Coverage',
  '',
  '| Workspace | Statements | Branches | Functions | Lines |',
  '| --- | --- | --- | --- | --- |',
  ...rows,
  '',
].join('\n');

console.log(table);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
}
