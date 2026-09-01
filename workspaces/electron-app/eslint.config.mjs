import tseslint from 'typescript-eslint';
import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts', '**/*.js'],
  languageOptions: {
    sourceType: 'commonjs',
    globals: globals.node,
    parserOptions: {
      projectService: true,
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
});
