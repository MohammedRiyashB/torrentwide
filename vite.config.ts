import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // GitHub Pages project-site URL: https://<owner>.github.io/torrentwide/
    base: '/torrentwide/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // WebTorrent depends on Node core modules. Map these to browser-safe shims.
        events: 'events/',
        path: 'path-browserify',
        process: 'process/browser',
      },
    },
    define: {
      global: 'globalThis',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env VAR.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
