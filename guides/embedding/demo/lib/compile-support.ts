import type { PluginObj } from '@babel/core';
import type Babel from '@babel/core';
import type { ASTv1, PreprocessOptions } from '@glimmer/syntax';
import type { Options } from 'babel-plugin-ember-template-compilation';
import type { PreprocessorOptions as ContentTagOptions } from 'content-tag';
import type { PrinterOptions } from 'node_modules/@glimmer/syntax/lib/generation/printer';
import { transform } from '@babel/standalone';
import { precompile } from '@glimmer/compiler';
import { preprocess as glimmerPreprocess, print } from '@glimmer/syntax';
import { ImportUtil } from 'babel-import-util';
import plugin from 'babel-plugin-ember-template-compilation';
import { Preprocessor } from 'content-tag';

type EmberCompiler = NonNullable<Options['compiler']>;

export const Compiler = {
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

const contentTagPreprocessor = new Preprocessor();

export function contentTag(source: string, options?: ContentTagOptions) {
  return contentTagPreprocessor.process(source, options);
}

export async function compile(
  source: string,
  options?: ContentTagOptions
): Promise<Babel.BabelFileResult & { code: string }> {
  const output = contentTag(source, options);
  const result = transform(output, {
    plugins: [[plugin, { compiler: Compiler } satisfies Options], [transformImports]],
  });

  // In real life, do something better than this
  if (typeof result?.code !== 'string') {
    throw new Error('Unable to compile');
  }

  return result as Babel.BabelFileResult & { code: string };
}

/**
 * Transform the imports emitted by the content tag preprocessor
 * into ones that
 */
function transformImports(babel: typeof Babel): PluginObj<State> {
  const { types: t } = babel;
  return {
    visitor: {
      Program: {
        enter: (path, state) => {
          state.util = new ImportUtil(babel, path);
        },
        exit: (_, state) => {
          state.util.removeImport('@ember/template-compiler', 'template');
        },
      },
      ImportDeclaration(path) {
        // Modify the source module if needed
        const source = path.node.source.value;
        if (source === '@ember/component') {
          path.node.source = t.stringLiteral('@glimmer/manager');
        }

        if (source === '@ember/component/template-only') {
          path.node.source = t.stringLiteral('@glimmer/runtime');

          path.node.specifiers = path.node.specifiers.map((specifier) => {
            if (t.isImportDefaultSpecifier(specifier) && specifier.local.name === 'templateOnly') {
              return t.importSpecifier(specifier.local, t.identifier('templateOnlyComponent'));
            } else {
              return specifier;
            }
          });
        }

        if (source === '@ember/template-factory') {
          path.node.source = t.stringLiteral('@glimmer/opcode-compiler');

          for (const specifier of path.node.specifiers) {
            if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
              const importedName = specifier.imported.name;
              if (importedName === 'createTemplateFactory') {
                specifier.imported = t.identifier('templateFactory');
              }
            }
          }
        }
      },
    },
  };
}

interface State {
  util: ImportUtil;
}

interface ModuleTag {
  [Symbol.toStringTag]: 'Module';
}
type ModuleObject = Record<string, unknown> & ModuleTag;

export async function asModule<T = ModuleObject>(
  source: string,
  { at, name = 'template.js' }: { at: { url: URL | string }; name?: string }
): Promise<T & ModuleTag> {
  if (typeof window === 'undefined') {
    const { default: fromMem } = await import('@peggyjs/from-mem');
    return fromMem(source, {
      filename: new URL(name, at.url).pathname,
      format: 'es',
    }) as Promise<T & ModuleTag>;
  }

  const blob = new Blob([source], { type: 'application/javascript' });

  return import(URL.createObjectURL(blob));

  // const init = createInitminalRun({
  //   whitelists: [...defaultSafeObjects, 'Proxy', 'WeakMap', 'WeakSet'],
  // });
  // const result = await init.run(
  //   source,
  //   {
  //     '@glimmer/validator': 'http://localhost:5173/node_modules/@glimmer/validator/index.ts',
  //     '@glimmer/manager': 'http://localhost:5173/node_modules/@glimmer/manager/index.ts',
  //     '@glimmer/opcode-compiler':
  //       'http://localhost:5173/node_modules/@glimmer/opcode-compiler/index.ts',
  //     '@glimmer/runtime': 'http://localhost:5173/node_modules/@glimmer/runtime/index.ts',
  //   },
  //   null,
  //   'default'
  // );

  // if (result.success) {
  //   console.log(result);
  //   return result.value as T & ModuleTag;
  // } else {
  //   throw result.error;
  // }
}

function esm(templateStrings: TemplateStringsArray, ...substitutions: string[]) {
  let js = templateStrings.raw[0] as string;
  for (let i = 0; i < substitutions.length; i++) {
    js += substitutions[i] + templateStrings.raw[i + 1];
  }
  return 'data:text/javascript;base64,' + btoa(js);
}
