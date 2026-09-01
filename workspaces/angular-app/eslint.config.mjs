import tseslint from 'typescript-eslint';
import { configs as angularConfigs, processInlineTemplates } from 'angular-eslint';
import baseConfig from '../../eslint.config.mjs';

export default tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.ts'],
    extends: [...angularConfigs.tsRecommended],
    processor: processInlineTemplates,
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angularConfigs.templateRecommended],
    rules: {},
  }
);
