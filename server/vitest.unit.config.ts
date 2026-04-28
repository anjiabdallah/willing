import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/services/**/*.test.ts', 'src/scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.types.ts'],
    },
    fileParallelism: true,
    exclude: ['node_modules', './dist'],
  },
});
