import { defineConfig } from 'vite';
import path from 'node:path';
const currentPath = import.meta.dirname;

const packagesPath = path.resolve(currentPath, '../../../packages');

export default defineConfig(({ mode }) => {
  let subDir = mode === 'production' ? 'prod' : 'dev';

  const packagePath = (name: string) => {
    const result = path.join(packagesPath, name, 'dist/' + subDir + '/index.js');
    return result;
  };

  return {
    resolve: {
      alias: {
        '@glimmer/compiler': packagePath('@glimmer/compiler'),
        '@glimmer/constants': packagePath('@glimmer/constants'),
        '@glimmer/debug': packagePath('@glimmer/debug'),
        '@glimmer/debug-util': packagePath('@glimmer/debug-util'),
        '@glimmer/destroyable': packagePath('@glimmer/destroyable'),
        '@glimmer/encoder': packagePath('@glimmer/encoder'),
        '@glimmer/global-context': packagePath('@glimmer/global-context'),
        '@glimmer/interfaces': packagePath('@glimmer/interfaces'),
        '@glimmer/manager': packagePath('@glimmer/manager'),
        '@glimmer/node': packagePath('@glimmer/node'),
        '@glimmer/opcode-compiler': packagePath('@glimmer/opcode-compiler'),
        '@glimmer/owner': packagePath('@glimmer/owner'),
        '@glimmer/program': packagePath('@glimmer/program'),
        '@glimmer/reference': packagePath('@glimmer/reference'),
        '@glimmer/runtime': packagePath('@glimmer/runtime'),
        '@glimmer/syntax': packagePath('@glimmer/syntax'),
        '@glimmer/validator': packagePath('@glimmer/validator'),
        '@glimmer/util': packagePath('@glimmer/util'),
        '@glimmer/vm': packagePath('@glimmer/vm'),
        '@glimmer/wire-format': packagePath('@glimmer/wire-format'),
      },
    },
  };
});
