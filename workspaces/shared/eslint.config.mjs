import tseslint from 'typescript-eslint';
import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts', '**/*.js'],
  languageOptions: {
    sourceType: 'commonjs',
    globals: globals.node,
    parserOptions: {
      projectService: {
        // Spec files and vitest.config.ts are excluded from tsconfig.json's own "include"
        // (so tsc --build never emits them to dist/) - this tells the project service to
        // still lint them via a one-off single-file program based on tsconfig.json, rather
        // than erroring that they're not part of any project. Listed explicitly (globstar
        // patterns are disallowed here as a guard against silently degrading a whole tree to
        // the slower single-file mode) - add new spec files to this list too.
        allowDefaultProject: [
          'src/apiDefinition/errors.spec.ts',
          'src/apiDefinition/validation.spec.ts',
          'src/apiDefinition/note/types.spec.ts',
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
  },
});
