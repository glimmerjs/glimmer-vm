/* eslint-disable no-console */
/* eslint-env node */
// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findWorkspaceDir } from '@pnpm/find-workspace-dir';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import replace from '@rollup/plugin-replace';
import rollupSWC from '@rollup/plugin-swc';
import terser from '@rollup/plugin-terser';
import ms from 'ms';
import * as insert from 'rollup-plugin-insert';
import { $, chalk } from 'zx';

import { inline } from './inline.js';

const { default: nodeResolve } = await import('@rollup/plugin-node-resolve');
const { default: postcss } = await import('rollup-plugin-postcss');
const { default: nodePolyfills } = await import('rollup-plugin-polyfill-node');
const { default: fonts } = await import('unplugin-fonts/vite');

/**
 * @import { ExternalOption, PackageInfo, PackageJSON, ViteConfig, RollupExport } from "./types.d.js";
 * @import { Plugin as RollupPlugin, RollupOptions } from "rollup";
 * @import { Project } from "@pnpm/workspace.find-packages";
 */

/**
 * The package should be inlined into the output. In this situation, the `external` function should
 * return `false`. This is the default behavior.
 */
const INLINE = false;

/**
 * The package should be treated as an external dependency. In this situation, the `external` function
 * should return `true`. This is unusual and should be used when:
 *
 * - The package is a "helper library" (such as tslib) that we don't want to make a real dependency
 *   of the published package.
 * - (for now) The package doesn't have good support for ESM (i.e. `type: module` in package.json)
 *   but rollup will handle it for us.
 */
const EXTERNAL = true;

/**
 * @param {PackageInfo} pkg
 * @param {'dev' | 'prod'} env
 * @returns {RollupPlugin[]}
 */
function typescript(pkg, env) {
  return [
    rollupSWC({
      swc: {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          target: 'es2022',
          transform: {
            constModules: {
              globals: { '@glimmer/env': { DEBUG: env === 'dev' ? 'true' : 'false' } },
            },
          },
        },
      },
    }),
    {
      name: 'Build Declarations',
      closeBundle: async function () {
        const types = [];
        if (pkg.devDependencies['@types/node']) {
          types.push('node');
        }

        const start = performance.now();
        await $({
          stdio: 'inherit',
        })`pnpm tsc --declaration --declarationDir dist/${env} --emitDeclarationOnly --isolatedDeclarations --module esnext --moduleResolution bundler ${
          pkg.exports
        } --types ${types.join(',')} --skipLibCheck --target esnext --strict`;
        const duration = performance.now() - start;
        console.log(
          `${chalk.green('created')} ${chalk.green.bold(`dist/${env}/index.d.ts`)} ${chalk.green(
            'in'
          )} ${chalk.green.bold(ms(duration))}`
        );
      },
    },
  ];
}

/**
 * @param {Project[]} packages
 */
function externals(packages) {
  const inlinedPackages = packages.flatMap((pkg) => {
    if (pkg.manifest.name && pkg.manifest.private === true) {
      return [pkg.manifest.name];
    } else {
      return [];
    }
  });
  return /** @type {const} */ ([
    [
      'is',
      ['@handlebars/parser', 'simple-html-tokenizer', 'babel-plugin-debug-macros'],
      'external',
    ],
    [
      'startsWith',
      ['.', '/', '#', '@babel/runtime/', process.cwd().replace(/\\/gu, '/')],
      'inline',
    ],
    ['is', ['tslib', ...inlinedPackages], 'inline'],
    ['startsWith', ['@glimmer/', '@simple-dom/', '@babel/', 'node:'], 'external'],
  ]);
}

/**
 * @param {string} id
 * @param {Project[]} packages
 * @returns {boolean | null}
 */
function matchExternals(id, packages) {
  id = id.replace(/\\/gu, '/');
  for (const [operator, prefixes, kind] of externals(packages)) {
    const result = match(id, operator, prefixes);

    if (result) {
      return kind === 'inline' ? INLINE : EXTERNAL;
    }
  }

  return null;
}

/**
 * @template {readonly string[]} Prefixes
 * @param {string} id
 * @param {'is' | 'startsWith'} operator
 * @param {Prefixes} prefixes
 */
function match(id, operator, prefixes) {
  return prefixes.some((prefix) => {
    switch (operator) {
      case 'is':
        return id === prefix;
      case 'startsWith':
        return id.startsWith(prefix);
    }
  });
}

/**
 * @implements {PackageInfo}
 */
export class Package {
  /**
   * @param {ImportMeta} meta
   * @returns {string}
   */
  static root(meta) {
    const dir = fileURLToPath(meta.url);
    return dirname(resolve(dir));
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {Package | undefined}
   */
  static at(meta) {
    const root = typeof meta === 'string' ? meta : Package.root(meta);

    /** @type {PackageJSON} */
    const json = parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    if (json.exports) {
      return new Package({
        name: json.name,
        exports: resolve(root, json.exports),
        devDependencies: json.devDependencies ?? {},
        keywords: json.keywords ?? [],
        root,
      });
    } else {
      for (const main of ['index.ts', 'index.js', 'index.d.ts']) {
        const path = resolve(root, main);
        if (existsSync(path)) {
          return new Package({
            name: json.name,
            exports: path,
            devDependencies: json.devDependencies ?? {},
            keywords: json.keywords ?? [],
            root,
          });
        }
      }

      console.warn(`No main entry point found for ${json.name} (in ${root})`);
    }
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {Promise<RollupExport>}
   */
  static async config(meta) {
    const workspace = await findWorkspaceDir(typeof meta === 'string' ? meta : meta.url);

    if (!workspace) {
      throw Error(`No workspace found at ${typeof meta === 'string' ? meta : Package.root(meta)}`);
    }

    const packages = await findWorkspacePackagesNoCheck(workspace);

    const pkg = Package.at(meta);

    if (pkg) {
      return pkg.config(packages);
    } else {
      return [];
    }
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {Promise<ViteConfig>}
   */
  static async viteConfig(meta) {
    const pkg = Package.at(meta);

    if (pkg) return pkg.#viteConfig();

    throw Error(`No package found at ${typeof meta === 'string' ? meta : Package.root(meta)}`);
  }

  /** @readonly @type {PackageInfo} */
  #package;

  /***
   * @param {PackageInfo} pkg
   */
  constructor(pkg) {
    this.#package = pkg;
  }

  get keywords() {
    return this.#package.keywords;
  }

  get devDependencies() {
    return this.#package.devDependencies;
  }

  /**
   * @returns {string}
   */
  get name() {
    return this.#package.name;
  }

  /**
   * @returns {string}
   */
  get exports() {
    return this.#package.exports;
  }

  /**
   * @returns {string}
   */
  get root() {
    return this.#package.root;
  }

  /**
   * @typedef {{esm?: boolean, cjs?: boolean}} Formats
   *
   * @param {Project[]} packages
   * @returns {import("rollup").RollupOptions[] | import("rollup").RollupOptions}
   */
  config(packages) {
    let builds = [];

    builds.push(...this.rollupESM({ env: 'dev' }, packages));
    builds.push(...this.rollupESM({ env: 'prod' }, packages));

    return builds;
  }

  /**
   * @returns {Promise<ViteConfig>}
   */
  async #viteConfig() {
    return viteConfig({
      plugins: [
        fonts({
          google: {
            families: ['Roboto:wght@300;400;500;700'],
            display: 'swap',
            preconnect: true,
          },
        }),
      ],
      optimizeDeps: {
        esbuildOptions: {
          define: {
            global: 'globalThis',
          },
        },
      },
      build: {},
    });
  }

  /**
   * @typedef {object} RollupConfigurationOptions
   * @property {'dev' | 'prod'} env
   *
   * @param {RollupConfigurationOptions} options
   * @param {Project[]} packages
   * @returns {RollupOptions[]}
   */
  rollupESM({ env }, packages) {
    return this.#shared('esm', env).map(
      (options) =>
        /** @satisfies {RollupOptions} */ ({
          ...options,
          external: this.#external(packages),
          plugins: [
            inline(),
            nodePolyfills(),
            nodeResolve({ extensions: ['.js', '.ts'] }),
            ...this.replacements(env),
            ...(env === 'prod'
              ? [
                  terser({
                    module: true,
                    // to debug the output, uncomment this so you can read the
                    // identifiers, unchanged
                    // mangle: false,
                    compress: {
                      passes: 3,
                      keep_fargs: false,
                      keep_fnames: false,
                      // unsafe_arrows: true,
                      // unsafe_comps: true,
                      // unsafe_math: true,
                      // unsafe_symbols: true,
                      // unsafe_function: true,
                      // unsafe_undefined: true,
                      // keep_classnames: false,
                      // toplevel: true,
                    },
                    format: {
                      wrap_func_args: false,
                    },
                  }),
                ]
              : [
                  terser({
                    module: true,
                    mangle: {
                      keep_classnames: true,
                      keep_fnames: false,
                    },
                    compress: {
                      passes: 3,
                      keep_fargs: false,
                      keep_fnames: false,
                    },
                    format: {
                      comments: 'all',
                      wrap_func_args: false,
                    },
                  }),
                ]),
            postcss(),
            ...typescript(this.#package, env),
          ],
        })
    );
  }

  /**
   * We only want importMeta stripped for production builds
   * @param {'dev' | 'prod'} env
   * @returns {any}
   */
  replacements(env) {
    return env === 'prod'
      ? [
          replace({
            preventAssignment: true,
            values: {
              // Intended to be left in the build during publish
              // currently compiled away to `@glimmer/debug`
              'import.meta.env.MODE': '"production"',
              'import.meta.env.DEV': 'false',
              'import.meta.env.PROD': 'true',
              // Not exposed at publish, compiled away
              'import.meta.env.VM_LOCAL_DEV': 'false',
            },
          }),
        ]
      : [
          replace({
            preventAssignment: true,
            values: {
              'import.meta.env.MODE': '"development"',
              'import.meta.env.DEV': 'DEBUG',
              'import.meta.env.PROD': '!DEBUG',
              'import.meta.env.VM_LOCAL_DEV': 'false',
            },
          }),
          insert.transform((_magicString, code, _id) => {
            if (code.includes('DEBUG')) {
              return `import { DEBUG } from '@glimmer/env';\n` + code;
            }
            return code;
          }),
        ];
  }

  /**
   * @param {Project[]} packages
   * @return {(id: string) => boolean}
   */
  #external(packages) {
    /**
     * @param {string} id
     * @returns {boolean}
     */
    return (id) => {
      const external = matchExternals(id, packages);

      if (external === null) {
        console.warn('unhandled external', id);
        return true;
      } else {
        return external;
      }
    };
  }

  /**
   * @param {"esm" | "cjs"} format
   * @param {"dev" | "prod"} env
   * @returns {import("rollup").RollupOptions[]}
   */
  #shared(format, env) {
    const { root, exports } = this.#package;

    const ext = format === 'esm' ? 'js' : 'cjs';

    const experiment = process.env['GLIMMER_EXPERIMENT'];

    /**
     * @param {[string, string]} entry
     * @returns {import("rollup").RollupOptions}
     */
    function entryPoint([exportName, ts]) {
      const file =
        experiment === undefined ? `${exportName}.${ext}` : `${exportName}.${experiment}.${ext}`;

      return {
        input: ts,
        treeshake: {
          // moduleSideEffects: false,
          moduleSideEffects: (id, external) => !external,
        },
        output: {
          file: resolve(root, 'dist', env, file),
          format,
          sourcemap: true,
          hoistTransitiveImports: false,
          exports: format === 'cjs' ? 'named' : 'auto',
        },
        onwarn: (warning, warn) => {
          switch (warning.code) {
            case 'CIRCULAR_DEPENDENCY':
            case 'EMPTY_BUNDLE':
              return;
            default:
              warn(warning);
          }
        },
      };
    }

    return [entryPoint([`index`, exports])];
  }
}

/**
 * @param {ViteConfig} config
 * @returns {Promise<ViteConfig>}
 */
async function viteConfig(config) {
  return Promise.resolve(config);
}

/**
 * @template T
 * @param {string} string
 * @returns {T}
 */
function parse(string) {
  return JSON.parse(string);
}
