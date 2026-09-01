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
  rules: {
    // Electron-specific rules
    '@typescript-eslint/no-var-requires': 'off', // Allow require() for CommonJS
    'import/no-commonjs': 'off', // Disable import plugin warnings for CommonJS,
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': 'off',
    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': 'error',
  },
};
