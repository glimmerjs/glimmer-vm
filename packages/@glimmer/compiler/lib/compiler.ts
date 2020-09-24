import {
  SerializedTemplateBlock,
  SerializedTemplateWithLazyBlock,
  TemplateJavascript,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { normalize, PrecompileOptions, Source, TemplateIdFn } from '@glimmer/syntax';
import { LOCAL_LOGGER } from '@glimmer/util';

import pass0 from './passes/1-normalization/index';
import { visit as pass1 } from './passes/2-symbol-allocation/index';
import { visit as pass2 } from './passes/3-encoding/index';

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

const defaultOptions: PrecompileOptions = {
  id: defaultId,
  meta: {},
};

/*
 * Compile a string into a template javascript string.
 *
 * Example usage:
 *     import { precompile } from '@glimmer/compiler';
 *     import { templateFactory } from 'glimmer-runtime';
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
  options?: PrecompileOptions
): SerializedTemplateBlock;
export function precompileJSON(
  string: string,
  options: PrecompileOptions = defaultOptions
): SerializedTemplateBlock {
  let ast = normalize(string, options);
  let source = new Source(string);
  let block = pass0(source, ast).mapOk((pass1In) => {
    let pass2In = pass1(source, pass1In);
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
 *     import { templateFactory } from 'glimmer-runtime';
 *     let templateJs = precompile("Howdy {{name}}");
 *     let factory = templateFactory(new Function("return " + templateJs)());
 *     let template = factory.create(env);
 *
 * @method precompile
 * @param {string} string a Glimmer template string
 * @return {string} a template javascript string
 */
export function precompile(string: string, options?: PrecompileOptions): TemplateJavascript;
export function precompile(
  source: string,
  options: PrecompileOptions = defaultOptions
): TemplateJavascript {
  let block = precompileJSON(source, options);

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
