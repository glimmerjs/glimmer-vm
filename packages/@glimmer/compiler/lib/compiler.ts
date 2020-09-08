import {
  Option,
  SerializedTemplateBlock,
  SerializedTemplateWithLazyBlock,
  TemplateJavascript,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { preprocess, PreprocessOptions } from '@glimmer/syntax';
import { LOCAL_LOGGER } from '@glimmer/util';
import { GlimmerCompileOptions } from './passes/pass0/context';
import { visit as pass0 } from './passes/pass0/index';
import { visit as pass1 } from './passes/pass1/index';
import { visit as pass2 } from './passes/pass2/index';

export interface TemplateIdFn {
  (src: string): Option<string>;
}

export interface PrecompileOptions extends PreprocessOptions {
  id?: TemplateIdFn;
}

declare function require(id: 'crypto'): Crypto;
declare function require(id: string): unknown;

interface Crypto {
  createHash(
    alg: 'sha1'
  ): {
    update(src: string, encoding: 'utf8'): void;
    digest(encoding: 'base64'): string;
  };
}

export const defaultId: TemplateIdFn = (() => {
  if (typeof require === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const crypto = require('crypto');

      let idFn: TemplateIdFn = (src) => {
        let hash = crypto.createHash('sha1');
        hash.update(src, 'utf8');
        // trim to 6 bytes of data (2^48 - 1)
        return hash.digest('base64').substring(0, 8);
      };

      idFn('test');

      return idFn;
    } catch (e) {}
  }

  return function idFn() {
    return null;
  };
})();

const defaultOptions: GlimmerCompileOptions = {
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
 * @param {string} string a Glimmer template string
 * @return {string} a template javascript string
 */
export function precompileJSON(
  source: string,
  options?: GlimmerCompileOptions
): SerializedTemplateBlock;
export function precompileJSON(
  string: string,
  options: GlimmerCompileOptions = defaultOptions
): SerializedTemplateBlock {
  let ast = preprocess(string, options);
  let block = pass0(string, ast, options).mapOk((pass1In) => {
    let pass2In = pass1(string, pass1In);
    return pass2(pass2In);
  });

  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.log(`Template ->`, block);
  }

  if (block.isOk) {
    return block.value;
  } else {
    throw block.reason;
  }
}

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
 * @param {string} string a Glimmer template string
 * @return {string} a template javascript string
 */
export function precompile(string: string, options?: GlimmerCompileOptions): TemplateJavascript;
export function precompile(
  source: string,
  options: GlimmerCompileOptions = defaultOptions
): TemplateJavascript {
  let block = precompileJSON(source, options);
  // let ast = preprocess(source, options);
  // let { meta } = options;
  // let opcodes = visit(source, ast);
  // let ops = allocate(opcodes, source);

  // let template = process(ops, ast.symbols!, source, options);

  // if (LOCAL_SHOULD_LOG) {
  //   console.log(`Template ->`, template);
  // }

  let idFn = options.id || defaultId;
  let blockJSON = JSON.stringify(block);
  let templateJSONObject: SerializedTemplateWithLazyBlock<unknown> = {
    id: idFn(JSON.stringify(options.meta) + blockJSON),
    block: blockJSON,
    meta: options.meta,
  };

  // JSON is javascript
  return JSON.stringify(templateJSONObject);
}
