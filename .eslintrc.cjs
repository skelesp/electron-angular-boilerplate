module.exports = {
  root: true,
  env: {
    node: true, // This tells ESLint to recognize Node.js globals like 'module' and 'require'
  },
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    // Shared rules for all workspaces
    'import/no-unresolved': [
      'error',
      {
        ignore: ['^@.*'], // Ignore paths for resolved aliases
      },
    ],
    'no-console': 'warn',
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto', // Added because of conflicting ESlint end of line formatting rules
      },
    ],
  },
  ignorePatterns: [
    '**/dist/**/*',
    '**/.dist/**/*',
    '**/coverage/**/*',
    '/node_modules/**/*',
    '**/node_modules/**/*',
    '**/plugins/**/*',
    '**/.webpack/**/*',
    '**/out/**/*',
    './*.ts',
  ],
};
