import type { ElementBuilder, RenderResult } from '@glimmer/interfaces';
import type { SomeReactive } from '@glimmer/reference';
import type { PrecompileOptions } from '@glimmer/syntax';
import type { TestJitContext } from './delegate';

import { renderMain, renderSync } from '@glimmer/runtime';
import { unwrapTemplate } from '@glimmer/util';

import { preprocess } from '../../compile';

export function renderTemplate(
  src: string,
  { runtime, program }: TestJitContext,
  self: SomeReactive,
  builder: ElementBuilder,
  options?: PrecompileOptions
): RenderResult {
  let template = preprocess(src, options);

  let iterator = renderMain(
    runtime,
    program,
    {},
    self,
    builder,
    unwrapTemplate(template).asLayout()
  );
  return renderSync(runtime.env, iterator);
}
