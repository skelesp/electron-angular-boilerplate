module.exports = {
  root: true,
  extends: [
    'plugin:@typescript-eslint/recommended',
    '../../.eslintrc.cjs', // Extend shared root config
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'script', // CommonJS
    project: ['./tsconfig.json'], // Specify the local tsconfig.json
    projectService: true, // Use TypeScript project service
  },
  ignorePatterns: ['dist/**/*', '.eslintrc.js'], // Ignore files
  env: {
    node: true, // Node.js global variables and scope
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json', // Or the path to your tsconfig.json
      },
    },
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    'import/no-unresolved': 'error',
  },
  env: {
    node: true,
  },
};
