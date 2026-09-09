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
    // `processInlineTemplates` above is what routes the `template:` strings in
    // notes.component.ts / settings.component.ts through this block too, so these rules
    // cover inline and templateUrl markup alike.
    files: ['**/*.html'],
    extends: [...angularConfigs.templateRecommended, ...angularConfigs.templateAccessibility],
    rules: {
      // Not part of templateAccessibility (it isn't strictly an a11y rule), but it belongs
      // with them: a <button> with no type defaults to submit, so the first time someone
      // wraps controls in a <form> - as the note composer does - an unrelated button starts
      // submitting it. Cheap to state, invisible to debug.
      '@angular-eslint/template/button-has-type': 'error',
    },
  }
);
