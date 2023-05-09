import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { defineConfig } from 'vite';

interface Package {
  name: string;
  version: string;
  path: string;
  main: string;
  private: boolean;
}

const packagesToPublish = getPackages();

const entries = Object.fromEntries(packagesToPublish.map((pkg) => [pkg.name, pkg.main]));

export default defineConfig({
  server: {
    open: '?hidepassed',
  },

  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.d.ts'],
  },

  build: {
    rollupOptions: {
      output: {},
    },
    lib: {
      entry: entries,
      formats: ['cjs', 'es'],
    },
  },
});

function getPackages(): Package[] {
  const packages: Package[] = JSON.parse(
    execSync(`pnpm -r ls --depth -1 --json`, { encoding: 'utf-8' }).trim()
  );

  return packages
    .filter((pkg) => pkg.private !== true)
    .map((pkg) => {
      if (existsSync(`${pkg.path}/index.ts`)) {
        return {
          ...pkg,
          main: `${pkg.path}/index.ts`,
        };
      } else if (existsSync(`${pkg.path}/index.d.ts`)) {
        return {
          ...pkg,
          main: `${pkg.path}/index.d.ts`,
        };
      } else if (existsSync(`${pkg.path}/index.js`)) {
        return {
          ...pkg,
          main: `${pkg.path}/index.js`,
        };
      }

      throw new Error(`Could not find package entry point for ${pkg.name}`);
    });
}
