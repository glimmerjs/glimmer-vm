import { DEBUG } from '@glimmer/env';
import { preprocess, print } from '@glimmer/syntax';
import { Option, TemplateJavascript, Statement } from '@glimmer/interfaces';
import { PreprocessOptions } from '@glimmer/syntax';
import { assert } from '@glimmer/util';
import TemplateCompiler, { CompileOptions } from './template-compiler';
import WireFormatDebugger from './wire-format-debug';

export interface TemplateIdFn {
  (src: string): Option<string>;
}

export interface PrecompileOptions extends CompileOptions, PreprocessOptions {
  id?: TemplateIdFn;
}

declare function require(id: string): any;

export const defaultId: TemplateIdFn = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');

    let idFn: TemplateIdFn = src => {
      let hash = crypto.createHash('sha1');
      hash.update(src, 'utf8');
      // trim to 6 bytes of data (2^48 - 1)
      return hash.digest('base64').substring(0, 8);
    };

    idFn('test');

    return idFn;
  } catch (e) {
    return function idFn() {
      return null;
    };
  }
})();

const defaultOptions: PrecompileOptions = {
  id: defaultId,
  meta: {},
};

/*
 * Compile a string into a template javascript string.
 *
 * Example usage:
 *     import { precompile } from '@glimmer/compiler';
 *     import { templateFactory } from 'glimer-runtime';
 *     let templateJs = precompile("Howdy {{name}}");
 *     let factory = templateFactory(new Function("return " + templateJs)());
 *     let template = factory.create(env);
 *
 * @method precompile
 * @param {string} source a Glimmer template string
 * @return {string} a template javascript string
 */
export function precompile(source: string, options?: PrecompileOptions): TemplateJavascript;
export function precompile(
  source: string,
  options: PrecompileOptions = defaultOptions
): TemplateJavascript {
  let ast = preprocess(source, options);
  let { meta } = options;
  let { block } = TemplateCompiler.compile(ast, source, options);

  let blockJSON = block.toJSON();
  let blockJSONString = JSON.stringify(blockJSON);

  let idFn = options.id || defaultId;
  let id = idFn(JSON.stringify(meta) + blockJSONString);

  let debug = new WireFormatDebugger(blockJSON);

  let obj = new ObjectCompiler();

  obj.set('id', id);
  obj.set('meta', meta);

  let func = new FunctionCompiler(obj.indentation);

  func.push('/*');
  func.push();

  func.push('Source:');
  func.push();
  func.push('```hbs');
  func.push(source);
  func.push('```');
  func.push();

  func.push('Transformed:');
  func.push();
  func.push('```hbs');
  func.push(print(ast));
  func.push('```');
  func.push();

  let wf = new ObjectCompiler(func.indentation);

  wf.set('symbols', blockJSON.symbols);
  wf.set('hasEval', blockJSON.hasEval);
  wf.set('upvars', blockJSON.upvars);

  let stmts = new WireFormatArrayCompiler(wf.indentation);

  blockJSON.statements.forEach(stmt => {
    stmts.add(stmt, debug.formatOpcode(stmt));
  });

  wf.setRaw('statements', stmts.compile());

  if (!DEBUG) {
    func.push('Wire Format:');
    func.push();
    func.push('```js');
    func.push(wf.compile());
    func.push('```');
    func.push();
  }

  func.push('*/');
  func.push();

  if (DEBUG) {
    func.push('/* Wire Format */');
    func.push();
    func.push(`return ${wf.compile()};`);
  } else {
    func.push(`return JSON.parse(${JSON.stringify(blockJSONString)});`);
  }

  obj.setRaw('block', func.compile());

  return obj.compile();
}

abstract class JavaScriptSyntaxCompiler {
  private lines: string[] = [];

  constructor(public indentation = '') {}

  indent() {
    this.indentation += '  ';
  }

  outdent() {
    let { indentation } = this;
    assert(indentation.length >= 2, 'cannot outdent any further');
    this.indentation = indentation.slice(0, -2);
  }

  protected abstract get prelude(): string;
  protected abstract get postlude(): string;

  protected get delimiter(): string {
    return '';
  }

  compile(lines = this.lines): string {
    let preindent = this.indentation;

    try {
      this.indent();
      return (
        preindent +
        this.prelude +
        '\n' +
        this.indentation +
        this.reindent(lines.join(`${this.delimiter}\n`)) +
        '\n' +
        preindent +
        this.postlude
      );
    } finally {
      this.outdent();
    }
  }

  protected push(line: string): void {
    this.lines.push(this.indentation + this.reindent(line));
  }

  protected quote(value: any, pretty = true): string {
    if (pretty) {
      return this.reindent(JSON.stringify(value, null, 2));
    } else {
      return JSON.stringify(value);
    }
  }

  protected reindent(text: string): string {
    return text.split('\n').join(`\n${this.indentation}`);
  }
}

class ObjectCompiler extends JavaScriptSyntaxCompiler {
  set(key: string, value: any): void {
    if (value !== undefined) {
      this.push(`${key}: ${this.quote(value)}`);
    }
  }

  setRaw(key: string, text: string): void {
    this.push(`${key}: ${text}`);
  }

  protected get prelude(): string {
    return '{';
  }

  protected get postlude(): string {
    return '}';
  }

  protected get delimiter(): string {
    return ',';
  }
}

class WireFormatArrayCompiler extends JavaScriptSyntaxCompiler {
  public add(statement: Statement, debug: unknown): void {
    super.push(`// ${this.quote(debug, false)}\n  ${this.quote(statement, false)}`);
  }

  protected get prelude(): string {
    return '[';
  }

  protected get postlude(): string {
    return ']';
  }

  protected get delimiter(): string {
    return ',';
  }
}

class FunctionCompiler extends JavaScriptSyntaxCompiler {
  public push(line = ''): void {
    super.push(line);
  }

  protected get prelude(): string {
    return '() => {';
  }

  protected get postlude(): string {
    return '}';
  }
}
