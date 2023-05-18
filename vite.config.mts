import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: '?hidepassed',
  },
  mode: 'testing',
});
