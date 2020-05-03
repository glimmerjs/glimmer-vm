import { precompile as rawPrecompile, PrecompileOptions } from '@glimmer/compiler';
import {
  AnnotatedModuleLocator,
  Environment,
  SerializedTemplateWithLazyBlock,
  Template,
  WireFormat,
} from '@glimmer/interfaces';
import { templateFactory, TemplateFactory } from '@glimmer/opcode-compiler';
import { assign } from '@glimmer/util';

export const DEFAULT_TEST_META: AnnotatedModuleLocator = Object.freeze({
  kind: 'unknown',
  meta: {},
  module: 'some/template',
  name: 'default',
});

// TODO: This fundamentally has little to do with testing and
// most tests should just use a more generic preprocess, extracted
// out of the test environment.
export function preprocess(
  source: string,
  meta?: AnnotatedModuleLocator
): Template<AnnotatedModuleLocator> {
  // eslint-disable-next-line no-new-func
  let parsed: SerializedTemplateWithLazyBlock<AnnotatedModuleLocator> = new Function(`
    return ${rawPrecompile(source, { meta })};
  `)();

  let factory = templateFactory<AnnotatedModuleLocator>(parsed);

  return factory.create(meta || DEFAULT_TEST_META);
}

export function createTemplate(
  source: string,
  options?: PrecompileOptions,
  runtimeMeta?: unknown
): TemplateFactory<AnnotatedModuleLocator> {
  // eslint-disable-next-line no-new-func
  let parsed: SerializedTemplateWithLazyBlock<AnnotatedModuleLocator> = new Function(`
    return ${rawPrecompile(source, options)};
  `)();

  if (runtimeMeta) {
    parsed.meta.meta = runtimeMeta;
  }

  return templateFactory<AnnotatedModuleLocator>(parsed);
}

export interface TestCompileOptions extends PrecompileOptions {
  env: Environment;
}

export function precompile(
  string: string,
  options?: TestCompileOptions
): WireFormat.SerializedTemplate<unknown> {
  // eslint-disable-next-line no-new-func
  let parsed: WireFormat.SerializedTemplateWithLazyBlock<unknown> = new Function(`
    return ${rawPrecompile(string, options)};
  `)();

  let block = parsed.block();

  return assign(parsed, { block });
}
