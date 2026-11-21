import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * `npm run build`        -> dist/         (normal static site; needs any web server)
 * `npm run build:single` -> dist-single/  (ONE index.html with everything inlined: opens by
 *                                          double-click from a ZIP, no server, no internet)
 */
const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
  build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 } : { chunkSizeWarningLimit: 2000 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
