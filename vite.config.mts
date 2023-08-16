import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: [],
  },
  server: {
    open: '?hidepassed',
  },
  plugins: [
    // react({
    //   babel: {
    //     plugins: [['@babel/plugin-proposal-decorators', { loose: true, version: '2023-05' }]],
    //   },
    // }),
  ],
  mode: 'testing',
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.d.ts'],
  },
});
