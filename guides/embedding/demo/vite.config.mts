import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['content-tag'],
    needsInterop: ['simple-dom'],
    // esbuildOptions: { target: 'es2022' },
    // noDiscovery: true,
  },
  resolve: {
    conditions: ['demo'],
  },
  esbuild: {
    target: 'esnext',
  },
  build: {
    target: 'esnext',
  },
});
