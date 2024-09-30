import type {
  Cursor as GlimmerCursor,
  Destroyable,
  Destructor,
  Dict,
  ElementBuilder,
  Environment,
  EnvironmentOptions,
  RenderResult,
  TemplateIterator,
} from '@glimmer/interfaces';
import type { EnvironmentDelegate } from '@glimmer/runtime';
import type { SimpleDocument, SimpleElement } from '@simple-dom/interface';
import { programCompilationContext } from '@glimmer/opcode-compiler';
import { artifacts, RuntimeOpImpl } from '@glimmer/program';
import {
  clientBuilder,
  rehydrationBuilder,
  renderComponent as glimmerRenderComponent,
  renderSync,
  runtimeContext,
} from '@glimmer/runtime';

import { setGlobalContext } from '../embed/global-context';
import { EnvDelegate, scheduledDestruction, scheduledFinishDestruction } from './env';
import { CompileTimeResolver, RuntimeResolver } from './resolver';

export interface RenderComponentOptions {
  element: SimpleElement;
  interactive?: boolean;
  args?: Dict<unknown>;
  owner?: object;
  rehydrate?: boolean;
}

type ResolveFn = () => void;
type RejectFn = (error: Error) => void;

let renderNotifiers: Array<[ResolveFn, RejectFn]> = [];

export function didRender(): Promise<void> {
  if (scheduled) {
    return new Promise((resolve, reject) => {
      renderNotifiers.push([resolve, reject]);
    });
  }
  return Promise.resolve();
}

export type ComponentDefinition = object;

async function renderRoot(
  ComponentClass: ComponentDefinition,
  options: RenderComponentOptions
): Promise<void>;
async function renderRoot(
  ComponentClass: ComponentDefinition,
  element: SimpleElement
): Promise<void>;
// eslint-disable-next-line @typescript-eslint/require-await
async function renderRoot(
  ComponentClass: ComponentDefinition,
  optionsOrElement: RenderComponentOptions | SimpleElement
): Promise<void> {
  const options: RenderComponentOptions =
    'nodeType' in optionsOrElement ? { element: optionsOrElement } : optionsOrElement;

  const { element, args, owner } = options;
  const document = element.ownerDocument as unknown as SimpleDocument;

  const { env, iterator } = getTemplateIterator(
    ComponentClass,
    element,
    { document },
    new EnvDelegate(options?.interactive ?? true),
    args,
    owner,
    options.rehydrate ? rehydrationBuilder : clientBuilder
  );
  const result = renderSync(env, iterator);
  results.push(result);
}

export default renderRoot;

const results: RenderResult[] = [];

let scheduled = false;
export function scheduleRevalidate(): void {
  if (scheduled) {
    return;
  }

  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    try {
      revalidate();
      renderNotifiers.forEach(([resolve]) => resolve());
    } catch (err) {
      renderNotifiers.forEach(([, reject]) => reject(err as Error));
    }

    renderNotifiers = [];
  }, 0);
}

setGlobalContext({
  schedule: {
    revalidate: scheduleRevalidate,
    destroy<T extends Destroyable>(destroyable: T, destructor: Destructor<T>) {
      scheduledDestruction.push({ destroyable, destructor });
    },

    destroyed(fn) {
      scheduledFinishDestruction.push(fn);
    },
  },
});

function revalidate(): void {
  for (const result of results) {
    const { env } = result;
    env.begin();
    result.rerender();
    env.commit();
  }
}

const resolver = new RuntimeResolver();
const sharedArtifacts = artifacts();
const context = programCompilationContext(
  sharedArtifacts,
  new CompileTimeResolver(),
  (heap) => new RuntimeOpImpl(heap)
);

export function getTemplateIterator(
  ComponentClass: ComponentDefinition,
  element: Element | SimpleElement,
  envOptions: EnvironmentOptions,
  envDelegate: EnvironmentDelegate,
  componentArgs: Dict<unknown> = {},
  owner: object = {},
  builderFactory: (env: Environment, cursor: GlimmerCursor) => ElementBuilder = clientBuilder
): { iterator: TemplateIterator; env: Environment } {
  const runtime = runtimeContext(envOptions, envDelegate, sharedArtifacts, resolver);
  const builder = builderFactory(runtime.env, {
    element,
    nextSibling: null,
  } as GlimmerCursor);

  return {
    iterator: glimmerRenderComponent(
      runtime,
      builder,
      context,
      owner,
      ComponentClass,
      componentArgs
    ),
    env: runtime.env,
  };
}
