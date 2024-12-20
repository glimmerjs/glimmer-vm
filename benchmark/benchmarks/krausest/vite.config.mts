import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';
import { precompile } from '@glimmer/compiler';
import { defineConfig } from 'vite';

const self = import.meta.url;

const currentPath = path.dirname(fileURLToPath(self));

export default defineConfig({
  plugins: [importMeta(), benchmark()],
  preview: {
    strictPort: true,
  },

  optimizeDeps: {
    noDiscovery: true,
    exclude: ['vite'],
  },

  resolve: {
    //#region aliases
    alias: {
      '@glimmer-workspace/benchmark-env': '@glimmer-workspace/benchmark-env/index.ts',
      '@/components': path.join(currentPath, 'lib', 'components'),
      '@/utils': path.join(currentPath, 'lib', 'utils'),
    },
    //#endregion
  },
});

function importMeta(): Plugin {
  return {
    name: 'define custom import.meta.env',
    transform(code) {
      if (code.includes('import.meta.env.VM_LOCAL_DEV')) {
        return code.replace(/import\.meta\.env\.VM_LOCAL_DEV/gu, 'false');
      }
      return undefined;
    },
    enforce: 'pre',
  };
}

function benchmark(): Plugin {
  return {
    enforce: 'pre',
    name: '@glimmer/benchmark',
    resolveId(id) {
      if (id === '@glimmer/env') {
        return '\0@glimmer/env';
      }
    },
    load(id) {
      if (id === '\0@glimmer/env') {
        return `export const DEBUG = false;`;
      }
      /** @type {string | undefined} */
      let result: string | undefined;
      if (id.endsWith('.hbs')) {
        const source = fs.readFileSync(id, 'utf8');
        const compiled = precompile(source);
        result = `export default ${compiled};`;
      }
      return result;
    },
  };
}
