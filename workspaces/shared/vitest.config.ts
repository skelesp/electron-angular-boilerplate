import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      // 'text-summary' keeps the CI log short; 'lcov' is the machine-readable format every
      // coverage service and IDE gutter plugin understands. Only produced with --coverage.
      reporter: ['text-summary', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/test-utils/**'],
    },
  },
});
