import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: 'zod', replacement: path.resolve(__dirname, 'node_modules/zod') },
    ],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    css: true,
    include: [
      'src/tests/**/*.test.{ts,tsx}',
    ],
    setupFiles: ['src/tests/vitest.setup.ts'],
  },
});
