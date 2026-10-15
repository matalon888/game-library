import { defineConfig } from 'vite';

// base relativa para o build funcionar em qualquer pasta/host
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
});
