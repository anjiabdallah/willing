import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.types.ts'],
    },
    globalSetup: './src/tests/globalSetup.ts',
    setupFiles: [
      './src/tests/setup.ts',
    ],
    fileParallelism: true,
    exclude: [
      'node_modules',
      './dist',
    ],
  },
});
