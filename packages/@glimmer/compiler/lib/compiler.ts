/* eslint-disable unicorn/prefer-module */
// TODO [1.0]: Be more principled about the crypto module dependency

import type {
  Nullable,
  SerializedTemplateBlock,
  SerializedTemplateWithLazyBlock,
  TemplateJavascript,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import {
  normalize,
  type PrecompileOptions,
  type PrecompileOptionsWithLexicalScope,
  src,
  type TemplateIdFn,
  hasStrictVariables,
} from '@glimmer/syntax';
import { LOCAL_LOGGER } from '@glimmer/util';

import pass0 from './passes/1-normalization/index';
import { visit as pass2 } from './passes/2-encoding/index';

declare function require(id: 'crypto'): Crypto;
declare function require(id: string): unknown;

interface Crypto {
  createHash(alg: 'sha1'): {
    update(source: string, encoding: 'utf8'): void;
    digest(encoding: 'base64'): string;
  };
}

export const defaultId: TemplateIdFn = (() => {
  let request: typeof require | undefined =
    typeof module === 'object' && typeof module.require === 'function'
      ? module.require
      : globalThis.require;

  if (request) {
    try {
      let crypto = request('crypto');

      let idFn: TemplateIdFn = (source) => {
        let hash = crypto.createHash('sha1');
        hash.update(source, 'utf8');
        // trim to 6 bytes of data (2^48 - 1)
        return hash.digest('base64').slice(0, 8);
      };

      idFn('test');

      return idFn;
    } catch {
      // do nothing
    }
  }

  return function idFn() {
    return null;
  };
})();

const defaultOptions: PrecompileOptions = {
  id: defaultId,
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
  string: Nullable<string>,
  options: PrecompileOptions | PrecompileOptionsWithLexicalScope = defaultOptions
): [block: SerializedTemplateBlock, usedLocals: string[]] {
  let source = new src.Source(string ?? '', options.meta?.moduleName);
  let [ast, locals] = normalize(source, { lexicalScope: () => false, ...options });
  let block = pass0(source, ast, hasStrictVariables(options.strictMode)).mapOk((pass2In) => {
    return pass2(pass2In);
  });

  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.log(`Template ->`, block);
  }

  if (block.isOk) {
    return [block.value, locals];
  } else {
    throw block.reason;
  }
}

// UUID used as a unique placeholder for placing a snippet of JS code into
// the otherwise JSON stringified value below.
const SCOPE_PLACEHOLDER = '796d24e6-2450-4fb0-8cdf-b65638b5ef70';

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
export function precompile(
  source: string,
  options: PrecompileOptions | PrecompileOptionsWithLexicalScope = defaultOptions
): TemplateJavascript {
  let [block, usedLocals] = precompileJSON(source, options);

  let moduleName = options.meta?.moduleName;
  let idFn = options.id || defaultId;
  let blockJSON = JSON.stringify(block);
  let templateJSONObject: SerializedTemplateWithLazyBlock = {
    id: idFn(JSON.stringify(options.meta) + blockJSON),
    block: blockJSON,
    moduleName: moduleName ?? '(unknown template module)',
    // lying to the type checker here because we're going to
    // replace it just below, after stringification
    scope: SCOPE_PLACEHOLDER as unknown as null,
    isStrictMode: hasStrictVariables(options.strictMode),
  };

  if (usedLocals.length === 0) {
    delete templateJSONObject.scope;
  }

  // JSON is javascript
  let stringified = JSON.stringify(templateJSONObject);

  if (usedLocals.length > 0) {
    let scopeFn = `()=>[${usedLocals.join(',')}]`;

    stringified = stringified.replace(`"${SCOPE_PLACEHOLDER}"`, scopeFn);
  }

  return stringified;
}

export { type PrecompileOptions } from '@glimmer/syntax';
