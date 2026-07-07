import { defineConfig } from 'vite';

// PORT lets a harness assign a free port; default stays 8137
const envPort = Number(globalThis.process?.env?.PORT);

export default defineConfig({
  server: { port: envPort || 8137, strictPort: true },
  build: { target: 'es2022' },
});
