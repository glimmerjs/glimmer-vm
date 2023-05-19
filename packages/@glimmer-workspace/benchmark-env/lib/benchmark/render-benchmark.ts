import type {
  CompileTimeCompilationContext,
  Dict,
  ResolvedComponentDefinition,
  RuntimeArtifacts,
  RuntimeResolver,
  SimpleElement,
} from '@glimmer/interfaces';
import { NewElementBuilder, renderComponent, renderSync, runtimeContext } from '@glimmer/runtime';

import type { UpdateBenchmark } from '../interfaces';
import createEnvironmentDelegate, { registerResult } from './create-env-delegate';
import { measureRender } from './util';

export default async function renderBenchmark(
  artifacts: RuntimeArtifacts,
  context: CompileTimeCompilationContext,
  runtimeResolver: RuntimeResolver,
  component: ResolvedComponentDefinition,
  args: Dict,
  element: SimpleElement,
  isInteractive = true
): Promise<UpdateBenchmark> {
  let resolveRender: (() => void) | undefined;

  await measureRender('render', 'renderStart', 'renderEnd', () => {
    const document = element.ownerDocument;
    const environmentDelegate = createEnvironmentDelegate(isInteractive);
    const runtime = runtimeContext(
      {
        document,
      },
      environmentDelegate,
      artifacts,
      runtimeResolver
    );
    const environment = runtime.env;
    const cursor = { element, nextSibling: null };
    const treeBuilder = NewElementBuilder.forInitialRender(environment, cursor);

    const result = renderSync(
      environment,
      renderComponent(runtime, treeBuilder, context, {}, component.state, args)
    );

    registerResult(result, () => {
      if (resolveRender !== undefined) {
        resolveRender();
        resolveRender = undefined;
      }
    });
  });

  performance.measure('load', 'navigationStart', 'renderStart');

  return async (name, update) => {
    await measureRender(
      name,
      name + 'Start',
      name + 'End',
      () =>
        new Promise((resolve) => {
          resolveRender = resolve;
          update();
        })
    );
  };
}
