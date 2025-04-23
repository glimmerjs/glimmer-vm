import { defineConfig } from 'vite';
import path from 'node:path';
const currentPath = import.meta.dirname;

const packagesPath = path.resolve(currentPath, '../../../packages');
const packagePath = (name: string) => {
  const result = path.join(packagesPath, name, 'dist/dev/index.js');
  return result;
};

export default defineConfig({
  resolve: {
    alias: {
      '@glimmer/opcode-compiler': packagePath('@glimmer/opcode-compiler'),
      '@glimmer/compiler': packagePath('@glimmer/compiler'),
      '@glimmer/manager': packagePath('@glimmer/manager'),
      '@glimmer/program': packagePath('@glimmer/program'),
      '@glimmer/validator': packagePath('@glimmer/validator'),
      '@glimmer/runtime': packagePath('@glimmer/runtime'),
    },
  },
});
