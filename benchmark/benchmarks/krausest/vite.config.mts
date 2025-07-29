import fs from 'node:fs';

import { precompile } from '@glimmer/compiler';
import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = import.meta.url;

const currentPath = path.dirname(fileURLToPath(self));
const packagesPath = path.resolve(currentPath, '..', '..', './../packages');

const packagePath = (name: string) => {
  return path.join(packagesPath, name, 'dist/prod/index.js');
};

export default defineConfig({
  plugins: [importMeta(), benchmark(), isolate()],
  preview: {
    strictPort: true,
  },
  resolve: {
    alias: {
      // This shouldn't be necessary, but the current `main` doesn't have properly
      // set up `package.json` files, so the built package isn't properly resolved.
      '@glimmer/compiler': packagePath('@glimmer/compiler'),
      '#components': path.join(currentPath, 'lib', 'components'),
      '#utils': path.join(currentPath, 'lib', 'utils'),
    },
  },
});

function importMeta(): Plugin {
  return {
    name: 'define custom import.meta.env',
    async transform(code) {
      if (code.includes('import.meta.env.VM_LOCAL_DEV')) {
        return code.replace(/import.meta.env.VM_LOCAL_DEV/g, 'false');
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
        const compiled = precompile(source, {
          meta: { moduleName: id },
        });
        result = `export default ${compiled};`;
      }
      return result;
    },
  };
}

function isolate(): Plugin {
  return {
    name: 'cross-origin-isolation',

    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        next();
      });
    },
  };
}
