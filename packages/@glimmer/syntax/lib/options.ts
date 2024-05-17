import type { Nullable } from '@glimmer/interfaces';

import type print from './generation/print';
import type * as src from './source/api';
import type traverse from './traversal/traverse';
import type { NodeVisitor } from './traversal/visitor';
import type Walker from './traversal/walker';
import type * as ASTv1 from './v1/api';
import type * as HBS from './v1/handlebars-ast';
import type publicBuilder from './v1/public-builders';

/**
  ASTPlugins can make changes to the Glimmer template AST before
  compilation begins.
*/

export interface ASTPluginBuilder<TEnv extends ASTPluginEnvironment = ASTPluginEnvironment> {
  (env: TEnv): ASTPlugin;
}

export interface ASTPlugin {
  name: string;
  visitor: NodeVisitor;
}

export interface ASTPluginEnvironment {
  meta?: object;
  syntax: Syntax;
}
interface HandlebarsParseOptions {
  srcName?: string;
  ignoreStandalone?: boolean;
}

export interface TemplateIdFn {
  (src: string): Nullable<string>;
}

export interface  PrecompileOptions extends PreprocessOptions {
  id?: TemplateIdFn;

  /**
   * Additional non-native keywords.
   *
   * Local variables (block params or lexical scope) always takes precedence,
   * but otherwise, suitable free variable candidates (e.g. those are not part
   * of a path) are matched against this list and turned into keywords.
   *
   * In strict mode compilation, keywords suppresses the undefined reference
   * error and will be resolved by the runtime environment.
   *
   * In loose mode, keywords are currently ignored and since all free variables
   * are already resolved by the runtime environment.
   */
  keywords?: readonly string[];

  customizeComponentName?: ((input: string) => string) | undefined;
}

export interface PrecompileOptionsWithLexicalScope extends PrecompileOptions {
  lexicalScope: (variable: string) => boolean;
}

export interface PreprocessOptions {
  strictMode?: boolean;
  locals?: string[];
  meta?: {
    moduleName?: string;
  };
  plugins?: {
    ast?: ASTPluginBuilder[];
  };
  parseOptions?: HandlebarsParseOptions;
  customizeComponentName?: ((input: string) => string) | undefined;

  /**
    Useful for specifying a group of options together.

    When `'codemod'` we disable all whitespace control in handlebars
    (to preserve as much as possible) and we also avoid any
    escaping/unescaping of HTML entity codes.
   */
  mode?: 'codemod' | 'precompile';

  log?: {
    warn?: (message: string) => void;
  };
}

export type Preprocess = (
  input: string | src.Source | HBS.Program,
  options?: PreprocessOptions
) => ASTv1.Template;

export type Builders = typeof publicBuilder;

export interface Syntax {
  parse: Preprocess;
  builders: Builders;
  print: typeof print;
  traverse: typeof traverse;
  Walker: typeof Walker;
}
