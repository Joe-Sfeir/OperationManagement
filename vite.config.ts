import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' so the built site runs from a ZIP / file:// without a server path.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
