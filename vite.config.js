import { defineConfig } from 'vite';

// PORT lets a harness assign a free port; default stays 8137
const envPort = Number(globalThis.process?.env?.PORT);

export default defineConfig({
  // falls forward to the next free port if 8137 is taken
  server: { port: envPort || 8137 },
  build: { target: 'es2022' },
});
