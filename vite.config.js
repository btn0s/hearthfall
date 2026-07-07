import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 8137, strictPort: true },
  build: { target: 'es2022' },
});
