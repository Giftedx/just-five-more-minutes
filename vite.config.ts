import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // single-page game; three.js in one chunk is fine
    chunkSizeWarningLimit: 1200,
  },
});
