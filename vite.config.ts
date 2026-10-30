import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isGitHubPagesBuild =
  process.env.GITHUB_ACTIONS === 'true' &&
  (process.env.GITHUB_REPOSITORY || '').toLowerCase() === 'mohammedriyashb/torrentwide';

export default defineConfig({
  // GitHub Pages serves this repository from /torrentwide; local/dev builds use /.
  base: isGitHubPagesBuild ? '/torrentwide/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': projectRoot,
      // WebTorrent depends on Node core modules; resolve browser-safe implementations.
      events: 'events/',
      path: 'path-browserify',
      process: 'process/browser',
    },
  },
  define: {
    global: 'globalThis',
    process: 'globalThis.process',
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
