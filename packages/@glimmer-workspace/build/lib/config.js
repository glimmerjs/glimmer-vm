/* eslint-disable no-console */
/* eslint-env node */
// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import replace from '@rollup/plugin-replace';
import rollupSWC from '@rollup/plugin-swc';
import terser from '@rollup/plugin-terser';
import ms from 'ms';
import * as insert from 'rollup-plugin-insert';
import ts from 'typescript';
import { $, chalk } from 'zx';

import inline from './inline.js';

// eslint-disable-next-line import/no-named-as-default-member
const { ModuleKind, ModuleResolutionKind, ScriptTarget } = ts;

const { default: nodeResolve } = await import('@rollup/plugin-node-resolve');
const { default: postcss } = await import('rollup-plugin-postcss');
const { default: nodePolyfills } = await import('rollup-plugin-polyfill-node');
const { default: fonts } = await import('unplugin-fonts/vite');

/**
 * @import { PartialCompilerOptions } from "@rollup/plugin-typescript";
 */
/** @typedef {import("typescript").CompilerOptions} CompilerOptions */
/** @typedef {import("./config.js").ExternalOption} ExternalOption */
/** @typedef {import("./config.js").PackageInfo} PackageInfo */
/** @typedef {import("./config.js").PackageJSON} PackageJSON */
/** @typedef {import("./config.js").PackageJsonInline} PackageJsonInline */
/** @typedef {import("rollup").Plugin} RollupPlugin */
/** @typedef {import("rollup").RollupOptions} RollupOptions */
/**
 * @typedef {import("./config.js").ViteConfig} ViteConfig
 * @typedef {import("./config.js").JsonValue} JsonValue
 * @typedef {import("./config.js").JsonObject} JsonObject
 * @typedef {import("./config.js").JsonArray} JsonArray
 * @typedef {import("./config.js").PackageJSON} PackageJson
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
 * @param {CompilerOptions} updates
 * @returns {PartialCompilerOptions & ts.CompilerOptions}
 */
export function tsconfig(updates) {
  return {
    declaration: true,
    emitDeclarationOnly: true,
    rewriteRelativeImportExtensions: true,
    // verbatimModuleSyntax: true,
    isolatedModules: true,
    module: ModuleKind.ESNext,
    moduleResolution: ModuleResolutionKind.Bundler,
    // experimentalDecorators: true,
    target: ScriptTarget.ESNext,
    noEmit: true,
    declarationDir: 'dist',
    ...updates,
  };
}

/**
 * @param {PackageInfo} pkg
 * @param {'dev' | 'prod'} env
 * @returns {RollupPlugin[]}
 */
export function typescript(pkg, env) {
  return [
    rollupSWC({
      swc: {
        jsc: {
          parser: {
            syntax: 'typescript',
            // decorators: true,
          },
          target: 'es2022',
          transform: {
            // legacyDecorator: true,
          },
        },
      },
    }),
    {
      name: 'Build Declarations',
      closeBundle: async function () {
        const start = performance.now();
        await $({
          stdio: 'inherit',
        })`pnpm tsc --declaration --declarationDir dist/${env} --emitDeclarationOnly --module esnext --moduleResolution bundler ${pkg.exports} --types vite/client,node --skipLibCheck --target esnext --strict`;
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

/** @type {['is' | 'startsWith', string[], 'inline' | 'external'][]} */
const EXTERNAL_OPTIONS = [
  [
    'is',
    [
      'tslib',
      '@glimmer/local-debug-flags',
      '@glimmer/constants',
      '@glimmer/debug',
      '@glimmer/debug-util',
    ],
    'inline',
  ],
  ['is', ['@handlebars/parser', 'simple-html-tokenizer', 'babel-plugin-debug-macros'], 'external'],
  ['startsWith', ['.', '/', '#', '@babel/runtime/', process.cwd().replace(/\\/gu, '/')], 'inline'],
  ['startsWith', ['@glimmer/', '@simple-dom/', '@babel/', 'node:'], 'external'],
];

/**
 * @param {string} id
 * @returns {boolean | null}
 */
function matchExternals(id) {
  id = id.replace(/\\/gu, '/');
  for (const [operator, prefixes, kind] of EXTERNAL_OPTIONS) {
    const result = match(id, operator, prefixes);

    if (result) {
      return kind === 'inline' ? INLINE : EXTERNAL;
    }
  }

  return null;
}

/**
 * @template {string[]} Prefixes
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
        root,
      });
    } else {
      for (const main of ['index.ts', 'index.js', 'index.d.ts']) {
        const path = resolve(root, main);
        if (existsSync(path)) {
          return new Package({
            name: json.name,
            exports: path,
            root,
          });
        }
      }

      console.warn(`No main entry point found for ${json.name} (in ${root})`);
    }
  }

  /**
   * @param {ImportMeta | string} meta
   * @returns {import("./config.js").RollupExport}
   */
  static config(meta) {
    const pkg = Package.at(meta);

    if (pkg) {
      return pkg.config();
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
   * @returns {import("rollup").RollupOptions[] | import("rollup").RollupOptions}
   */
  config() {
    let builds = [];

    builds.push(...this.rollupESM({ env: 'dev' }));
    builds.push(...this.rollupESM({ env: 'prod' }));

    return builds;
  }

  /**
   * @returns {Promise<import("./config.js").ViteConfig>}
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
   * @returns {RollupOptions[]}
   */
  rollupESM({ env }) {
    return this.#shared('esm', env).map(
      (options) =>
        /** @satisfies {RollupOptions} */ ({
          ...options,
          external: this.#external,
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
   * @return {(id: string) => boolean}
   */
  get #external() {
    /**
     * @param {string} id
     * @returns {boolean}
     */
    return (id) => {
      const external = matchExternals(id);

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
 * @param {import("./config.js").ViteConfig} config
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
