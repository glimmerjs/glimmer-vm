import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: '?hidepassed',
  },
  mode: 'testing',

  plugins: [
    {
      name: 'define custom import.meta.env',
      transform(code) {
        if (code.includes('import.meta.env.VM_LOCAL_DEV')) {
          return code.replace(/import.meta.env.VM_LOCAL_DEV/gu, 'true');
        }
        return undefined;
      },
      enforce: 'pre',
    },
  ],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.d.ts'],
  },
});
