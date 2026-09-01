// Shared flat-config base, imported and extended by each workspace's own
// eslint.config.mjs. See https://eslint.org/docs/latest/use/configure/configuration-files
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

const baseConfig = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.dist/**',
      '**/coverage/**',
      '**/.webpack/**',
      '**/out/**',
      '**/.angular/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      prettierRecommended,
    ],
    rules: {
      'no-console': 'warn',
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
    },
  },
);

export default baseConfig;
