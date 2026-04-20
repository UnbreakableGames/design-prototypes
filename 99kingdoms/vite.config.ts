import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works when itch.io serves it from a
  // sub-path rather than the site root.
  base: './',
  server: { port: 5173 },
});
