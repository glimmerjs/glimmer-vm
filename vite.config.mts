import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: '?hidepassed',
    hmr: {
      overlay: true,
    },
  },
  mode: 'testing',
});
