import type {
  Cursor as GlimmerCursor,
  Destroyable,
  Destructor,
  Dict,
  ElementBuilder,
  Environment,
  EnvironmentOptions,
  TemplateIterator,
} from '@glimmer/interfaces';
import type { SharedArtifacts } from '@glimmer/program';
import type { EnvironmentDelegate } from '@glimmer/runtime';
import type { SimpleDocument, SimpleElement } from '@simple-dom/interface';
import { associateDestroyableChild } from '@glimmer/destroyable';
import { programCompilationContext } from '@glimmer/opcode-compiler';
import { artifacts, RuntimeOpImpl } from '@glimmer/program';
import {
  clientBuilder,
  rehydrationBuilder,
  renderComponent as glimmerRenderComponent,
  renderSync,
  runtimeContext,
} from '@glimmer/runtime';

import type { ScheduleDelegate } from '../embed/global-context';
import type { Destruction, Finalize } from './env';

import { setGlobalEnv } from '../embed/global-context';
import { EnvDelegate, scheduledDestruction, scheduledFinishDestruction } from './env';
import { CompileTimeResolver, RuntimeResolver } from './resolver';
import { RenderRoot } from './root';

export interface RenderComponentOptions {
  element: SimpleElement;
  interactive?: boolean;
  args?: Dict<unknown>;
  owner?: object;
  rehydrate?: boolean;
}

type ResolveFn = () => void;
type RejectFn = (error: Error) => void;

export function addRoot(root: RenderRoot) {
  results.push(root);
}

export type ComponentDefinition = object;

async function renderRoot(
  ComponentClass: ComponentDefinition,
  options: RenderComponentOptions
): Promise<RenderRoot>;
async function renderRoot(
  ComponentClass: ComponentDefinition,
  element: SimpleElement
): Promise<RenderRoot>;
// eslint-disable-next-line @typescript-eslint/require-await
async function renderRoot(
  ComponentClass: ComponentDefinition,
  optionsOrElement: RenderComponentOptions | SimpleElement
): Promise<RenderRoot> {
  const options: RenderComponentOptions =
    'nodeType' in optionsOrElement ? { element: optionsOrElement } : optionsOrElement;

  const { element, args, owner } = options;
  const document = element.ownerDocument as unknown as SimpleDocument;

  const { env, iterator } = getTemplateIterator(
    ComponentClass,
    element,
    { document },
    new EnvDelegate({
      interactive: options.interactive ?? true,
      document: element.ownerDocument,
    }),
    args,
    owner,
    options.rehydrate ? rehydrationBuilder : clientBuilder
  );
  const result = renderSync(env, iterator);
  return new RenderRoot(result);
}

export default renderRoot;

const results: RenderRoot[] = [];

let scheduled = false;
class Revalidator {
  #roots: Roots;
  #buckets = {
    destroy: [] as Destruction[],
    finalize: [] as Finalize[],
    revalidate: false,
  };

  #scheduled = false;
  #renderNotifiers: Array<[ResolveFn, RejectFn]> = [];

  constructor() {
    this.#roots = new Roots();
    associateDestroyableChild(this, this.#roots);
  }

  scheduleDestroy(destroyable: Destroyable, destructor: Destructor<Destroyable>) {
    this.#buckets.destroy.push({ destroyable, destructor });
  }

  scheduleFinalize(finalize: Finalize) {
    this.#buckets.finalize.push(finalize);
  }

  scheduleRevalidate(): void {
    if (this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    setTimeout(() => {
      this.#scheduled = false;
      try {
        this.#roots.revalidate();
        this.#renderNotifiers.forEach(([resolve]) => resolve());
      } catch (err) {
        this.#renderNotifiers.forEach(([, reject]) => reject(err as Error));
      }

      this.#renderNotifiers = [];
    }, 0);
  }

  #schedule() {
    if (this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    setTimeout(() => {
      this.#scheduled = false;

      restart: while (this.#hasQueuedItems()) {
        const destroy = this.#buckets.destroy;
        this.#buckets.destroy = [];
        for (const { destroyable, destructor } of destroy) {
          destructor(destroyable);
        }

        if (this.#buckets.destroy.length > 0) {
          break restart;
        }

        const finalizers = this.#buckets.finalize;
        this.#buckets.finalize = [];
        for (const finalize of finalizers) {
          finalize();
        }

        if (this.#buckets.destroy.length > 0 || this.#buckets.finalize.length > 0) {
          break restart;
        }

        const revalidate = this.#buckets.revalidate;
        this.#buckets.revalidate = false;
        if (revalidate) {
          this.#roots.revalidate();
        }
      }
    }, 0);
  }

  #hasQueuedItems() {
    return !this.#isEmpty();
  }

  #isEmpty() {
    return (
      this.#buckets.destroy.length === 0 &&
      this.#buckets.finalize.length === 0 &&
      !this.#buckets.revalidate
    );
  }

  didRender(): Promise<void> {
    if (scheduled) {
      return new Promise((resolve, reject) => {
        this.#renderNotifiers.push([resolve, reject]);
      });
    }
    return Promise.resolve();
  }

  getRenderNotifiers(): Array<[ResolveFn, RejectFn]> {
    return this.#renderNotifiers;
  }
}

const revalidator = new Revalidator();

setGlobalEnv({
  didMutate: () => revalidator.scheduleRevalidate(),
  scheduleDestroy: <T extends Destroyable>(destroyable: T, destructor: Destructor<T>) => {
    scheduledDestruction.push({ destroyable, destructor });
  },
  schedule: {
    revalidate: () => revalidator.scheduleRevalidate(),
    destroy<T extends Destroyable>(destroyable: T, destructor: Destructor<T>) {
      scheduledDestruction.push({ destroyable, destructor });
    },

    destroyed(fn) {
      scheduledFinishDestruction.push(fn);
    },
  },
});



class Roots {
  #roots: RenderRoot[] = [];

  async renderRoot(
    ComponentClass: ComponentDefinition,
    options: RenderComponentOptions
  ): Promise<RenderRoot> {
    const root = await renderRoot(ComponentClass, options);
    this.#roots.push(root);
    associateDestroyableChild(this, root);
    return root;
  }

  revalidate() {
    for (const root of this.#roots) {
      root.revalidate();
    }
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

export interface GlobalRuntimeOptions extends ScheduleDelegate {}

export interface EnvRuntimeOptions {
  /**
   * The document that should be used to create DOM nodes. In SSR mode,
   * this is a SimpleDOM Document, but it's usually a regular document.
   */
  document: SimpleDocument | Document;
  /**
   * An interactive environment runs element modifiers, while a
   * non-interactive environment (i.e. SSR) does not.
   *
   * This defaults to true when the document is an instance of
   * `globalThis.Document`, and false otherwise.
   */
  interactive?: boolean;
  /**
   * Setting this to true enables Glimmer's debug tooling, which
   * installs an instance of `DebugRenderTree` on the environment.
   */
  debug?: boolean;
  /**
   * This callback will be called after the Glimmer runtime commits
   * a render transaction.
   */
  onCommit?: () => void;
}

interface CompileRuntimeOptions {
  resolver: CompileTimeResolver | 'strict';
}

interface RuntimeOptions {
  global: GlobalRuntimeOptions;
  env: EnvRuntimeOptions;
  compile: CompileRuntimeOptions;
}

class GlimmerRuntime {
  #resolver: CompileTimeResolver;
  #options: RuntimeOptions;
  #artifacts: SharedArtifacts;
  #context: CompileTimeCompilationContext;

  constructor(options: RuntimeOptions) {
    this.#options = options;
    this.#resolver =
      typeof options?.compile.resolver === 'object'
        ? options.compile.resolver
        : new CompileTimeResolver();
    this.#artifacts = artifacts();
    this.#runtime = runtimeContext(
      { document: options.env.document as SimpleDocument },
      {
        isInteractive: options.env.interactive ?? true,
        enableDebugTooling: options.env.debug ?? false,
        onTransactionCommit: options.env.onCommit ?? (() => {}),
      },
      this.#artifacts,
      this.#resolver
    );
    this.#context = programCompilationContext(
      this.#artifacts,
      typeof options?.resolver === 'object' ? options.resolver : new CompileTimeResolver(),
      (heap) => new RuntimeOpImpl(heap)
    );
  }
}

/**
 * A function that creates a new runtime environment.
 *
 * Goals:
 *
 * 1. Encapsulate details that are shared between Ember (the environment with
 *    the most customizations), Glimmer.js (a previous production environment)
 *    and the anticipated `@glimmer/core`.
 * 2. Default options assume strict mode, so that the low-configuration path
 *    is also the modern path.
 */
export function createRuntime(options: RuntimeOptions = { resolver: 'strict' }) {
  const sharedArtifacts = artifacts();
  const context = programCompilationContext(
    sharedArtifacts,
    typeof options?.resolver === 'object' ? options.resolver : new CompileTimeResolver(),
    (heap) => new RuntimeOpImpl(heap)
  );
}
