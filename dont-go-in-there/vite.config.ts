import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: false },
  // Build into ./play/ so the bundle can be committed and served from
  // GitHub Pages at /dont-go-in-there/play/ (cleaner URL than /dist/).
  build: { outDir: 'play', emptyOutDir: true },
});
