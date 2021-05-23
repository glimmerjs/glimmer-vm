import { JitTestDelegateContext } from './delegate';
import { PrecompileOptions } from '@glimmer/syntax';
import { ElementBuilder, RenderResult, Source } from '@glimmer/interfaces';
import { preprocess } from '../../compile';
import { renderMain, renderSync } from '@glimmer/runtime';
import { unwrapTemplate } from '@glimmer/util';

export function renderTemplate(
  src: string,
  { runtime, program }: JitTestDelegateContext,
  self: Source,
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
