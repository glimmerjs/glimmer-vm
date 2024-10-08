import type { PluginObj } from '@babel/core';
import type Babel from '@babel/core';
import type { ASTv1, PreprocessOptions } from '@glimmer/syntax';
import type { Options as EmberTemplateCompilerOptions } from 'babel-plugin-ember-template-compilation';
import type { PreprocessorOptions as ContentTagOptions } from 'content-tag';
import type { PrinterOptions } from 'node_modules/@glimmer/syntax/lib/generation/printer';
import { transform } from '@babel/standalone';
import { precompile } from '@glimmer/compiler';
import { preprocess as glimmerPreprocess, print } from '@glimmer/syntax';
import emberTemplateCompiler from 'babel-plugin-ember-template-compilation';
import { Preprocessor } from 'content-tag';

import type { Rewrites } from './rewrite';

import { rewrite } from './rewrite';

type EmberCompiler = NonNullable<EmberTemplateCompilerOptions['compiler']>;

export class GjsCompiler {
  readonly #hbsCompiler = {
    precompile(templateString: string, options: PreprocessOptions): string {
      return precompile(templateString, options);
    },
    _preprocess(templateString: string, options: PreprocessOptions): ASTv1.Template {
      return glimmerPreprocess(templateString, options);
    },
    _buildCompileOptions(options: PreprocessOptions): PreprocessOptions {
      return options;
    },
    _print(ast: ASTv1.Template, options?: PrinterOptions): string {
      return print(ast, options);
    },
  } as unknown as EmberCompiler;

  readonly #contentTagPreprocessor = new Preprocessor();

  #contentTag(source: string, options?: ContentTagOptions) {
    return this.#contentTagPreprocessor.process(source, options);
  }

  compile = async (
    source: string,
    options?: ContentTagOptions
  ): Promise<Babel.BabelFileResult & { code: string }> => {
    const output = this.#contentTag(source, options);
    const result = transform(output, {
      filename: options?.filename ?? 'unknown',
      plugins: [
        [
          emberTemplateCompiler,
          { compiler: this.#hbsCompiler } satisfies EmberTemplateCompilerOptions,
        ],
        [
          transformImports,
          {
            '@ember/component': { to: '@glimmer/manager' },
            '@ember/component/template-only': {
              to: '@glimmer/runtime',
              specifier: {
                from: 'default',
                to: 'templateOnlyComponent',
              },
            },
            '@ember/template-factory': {
              to: '@glimmer/opcode-compiler',
              specifier: {
                from: 'createTemplateFactory',
                to: 'templateFactory',
              },
            },
          } satisfies Rewrites,
        ],
      ],
    });

    // In real life, do something better than this
    if (typeof result?.code !== 'string') {
      throw new Error('Unable to compile');
    }

    result.code = result.code.replace(
      /"moduleName":\s"[^"]+"/u,
      `"moduleName": "${options?.filename ?? 'unknown'}"`
    );

    return Promise.resolve(result as Babel.BabelFileResult & { code: string });
  };
}

/**
 * Transform the imports emitted by the content tag preprocessor
 * into ones that
 */
function transformImports(babel: typeof Babel, rewrites: Rewrites): PluginObj<null> {
  return {
    visitor: {
      ImportDeclaration(path) {
        return rewrite(babel.types, path, rewrites);
      },
    },
  };
}

const GJS_COMPILER = new GjsCompiler();

export const compile = GJS_COMPILER.compile;
