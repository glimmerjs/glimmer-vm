import {
  SerializedTemplateBlock,
  SerializedTemplateWithLazyBlock,
  TemplateJavascript,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { normalize, PrecompileOptions, Source, TemplateIdFn } from '@glimmer/syntax';
import { LOCAL_LOGGER } from '@glimmer/util';

import pass0 from './passes/1-normalization/index';
import { visit as pass2 } from './passes/2-encoding/index';

let templateId = 0;
export const defaultId: TemplateIdFn = (() => {
  return () => {
    templateId++;
    return String(templateId);
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
  string: string,
  options: PrecompileOptions = defaultOptions
): [block: SerializedTemplateBlock, usedLocals: string[]] {
  let source = new Source(string, options.meta?.moduleName);
  let [ast, locals] = normalize(source, options);
  let block = pass0(source, ast, options.strictMode ?? false).mapOk((pass2In) => {
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
  options: PrecompileOptions = defaultOptions
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
    scope: (SCOPE_PLACEHOLDER as unknown) as null,
    isStrictMode: options.strictMode ?? false,
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

export { PrecompileOptions };
