import { defineConfig } from 'vite';
import { swcUnpluginTs as swc } from 'swc-unplugin-ts';

export default defineConfig({
  server: {
    open: '?hidepassed&todo-behavior=hide-valid',
  },

  plugins: [
    swc.vite({
      module: { type: 'es6' },
      isModule: true,
      tsconfigFile: false,
      jsc: {
        target: 'es2022',
        transform: { useDefineForClassFields: true, decoratorVersion: '2022-03' },
        parser: { syntax: 'typescript', tsx: false, decorators: true },
      },
    }),
  ],
  // mode: 'testing',
});
