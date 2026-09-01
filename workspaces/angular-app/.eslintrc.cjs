module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    // Remove the project key for general parser options
    // project: ['./workspaces/angular-app/tsconfig.json', './workspaces/angular-app/tsconfig.spec.json'],
  },
  plugins: ['@angular-eslint', '@typescript-eslint'],
  overrides: [
    {
      // TypeScript Files
      files: ['*.ts'],
      extends: [
        'plugin:@angular-eslint/recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      parser: '@typescript-eslint/parser',
      rules: {
        '@typescript-eslint/ban-ts-comment': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
        //'@typescript-eslint/no-explicit-any': 'error',
      },
    },
    {
      // HTML Files
      files: ['*.html'],
      extends: ['plugin:@angular-eslint/template/recommended'],
      parser: '@angular-eslint/template-parser',
      rules: {
        // Add any HTML-specific rules if needed
      },
    },
  ],
};
