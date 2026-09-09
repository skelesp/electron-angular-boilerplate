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
      // The renderer has no logger of its own, so the few deliberate diagnostics it emits
      // (a failed bootstrap, a missing Electron bridge) go to the console. A stray
      // console.log is still flagged.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angularConfigs.templateRecommended],
    rules: {},
  }
);
