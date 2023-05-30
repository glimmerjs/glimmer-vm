import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: '?hidepassed&todo-behavior=hide-valid',
  },
  mode: 'testing',
});
