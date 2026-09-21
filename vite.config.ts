import { defineConfig } from 'vite';

// Stamped into the start screen so you can tell which build a phone is really running.
const BUILD = new Date().toISOString().slice(5, 16).replace('T', ' ');

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: { port: 5173 },
  build: { target: 'es2022' },
});
