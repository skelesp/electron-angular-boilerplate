import tseslint from 'typescript-eslint';
import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

export default tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
      parserOptions: {
        projectService: {
          // Spec files, src/test-utils, and vitest.config.ts are excluded from tsconfig.json's
          // own "include" (so tsc --build never emits them to dist/) - this tells the project
          // service to still lint them via a one-off single-file program based on
          // tsconfig.json, rather than erroring that they're not part of any project. Listed
          // explicitly (globstar patterns are disallowed here as a guard against silently
          // degrading a whole tree to the slower single-file mode) - add new spec files here too.
          allowDefaultProject: [
            'src/events.spec.ts',
            'src/handlersRegistry.spec.ts',
            'src/models/notes/Note.repository.spec.ts',
            'src/models/notes/note.handler.spec.ts',
            'src/models/theme/theme.handler.spec.ts',
            'src/test-utils/sqliteTestDataSource.ts',
            'src/updater.spec.ts',
            'vitest.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'error',
    },
  },
  {
    // The build scripts report what they copied/vendored on stdout - that output is the
    // point of running them, not a leftover debug line. They are .mjs, so the block above
    // (.ts/.js only) never covered them and the root config's 'no-console': 'warn' applied.
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  }
);
