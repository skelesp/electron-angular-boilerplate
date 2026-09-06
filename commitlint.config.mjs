// Conventional Commits, checked on a `commit-msg` hook (see .husky/commit-msg).
//
// The point is not ceremony: the changelog is assembled from `git log`, and a template repo's
// most common change - a dependency bump - reads very differently from a change to the API
// contract. `type` is what makes that sortable.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The workspace a change lands in is the scope worth naming. Not required - plenty of
    // changes here are repo-wide - but constrained so the vocabulary stays small enough to
    // group by.
    'scope-enum': [
      2,
      'always',
      [
        'shared',
        'electron-app',
        'angular-app',
        'e2e',
        'build',
        'ci',
        // What Dependabot is configured to use - see .github/dependabot.yml.
        'deps',
        'deps-dev',
        'docs',
        'release',
      ],
    ],
    // Long subjects get truncated everywhere they are displayed; the body has no such limit.
    'header-max-length': [2, 'always', 100],
    // Dependabot's own commit messages are sentence-cased ("Bump vitest from ..."), and a
    // rule that fails every automated PR is a rule that gets disabled a week later.
    'subject-case': [0],
  },
};
