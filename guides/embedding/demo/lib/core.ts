/* eslint-disable @typescript-eslint/consistent-type-imports */
import type {
  CompileTimeCompilationContext,
  Cursor as GlimmerCursor,
  Dict,
  ElementBuilder,
  Environment,
  EnvironmentOptions,
  RenderResult,
  TemplateIterator,
} from '@glimmer/interfaces';
import type { SharedArtifacts } from '@glimmer/program';
import type { EnvironmentDelegate } from '@glimmer/runtime';
import type { SimpleDocument, SimpleElement } from '@simple-dom/interface';

import type { Destruction, Finalize } from './core/env';

import { EnvDelegate } from './core/env';
import { CompileTimeResolver, RuntimeResolver } from './core/resolver';
import { setGlobalEnv } from './embed/global-context';

interface Deps {
  runtime: typeof import('@glimmer/runtime');
  program: typeof import('@glimmer/program');
  opcodes: typeof import('@glimmer/opcode-compiler');
  global: typeof import('@glimmer/global-context');
}

export type ComponentDefinition = object;
type ResolveFn = () => void;
type RejectFn = (error: Error) => void;

export class GlimmerRuntime {
  static enable(options: RuntimeOptions) {
    return new GlimmerRuntime(options);
  }

  #renderNotifiers: Array<[ResolveFn, RejectFn]> = [];
  #scheduled = false;
  #options: RuntimeOptions;
  #roots: RenderResult[] = [];
  #destructions: Destruction[] = [];
  #finalizers: Finalize[] = [];
  #deps: Deps;

  #resolver = new RuntimeResolver();
  #sharedArtifacts: SharedArtifacts;
  #context: CompileTimeCompilationContext;

  constructor(options: RuntimeOptions) {
    this.#options = options;
    this.#deps = options.deps;
    this.#sharedArtifacts = this.#deps.program.artifacts();
    this.#context = this.#deps.opcodes.programCompilationContext(
      this.#sharedArtifacts,
      new CompileTimeResolver(),
      (heap) => new this.#deps.program.RuntimeOpImpl(heap)
    );

    setGlobalEnv(
      {
        didMutate: () => {
          this.#scheduleRevalidate();
        },
        scheduleDestroy: (destroyable, destructor) => {
          this.#destructions.push({ destroyable, destructor });
        },
        scheduleFinalize: (callback) => {
          this.#finalizers.push(callback);
        },
      },
      this.#deps.global.default
    );
  }

  #getTemplateIterator(
    ComponentClass: ComponentDefinition,
    element: Element | SimpleElement,
    envOptions: EnvironmentOptions,
    envDelegate: EnvironmentDelegate,
    componentArgs: Dict<unknown> = {},
    owner: object = {},
    builderFactory: (env: Environment, cursor: GlimmerCursor) => ElementBuilder = this.#deps.runtime
      .clientBuilder
  ): { iterator: TemplateIterator; env: Environment } {
    const runtime = this.#deps.runtime.runtimeContext(
      envOptions,
      envDelegate,
      this.#sharedArtifacts,
      this.#resolver
    );
    const builder = builderFactory(runtime.env, {
      element,
      nextSibling: null,
    } as GlimmerCursor);

    return {
      iterator: this.#deps.runtime.renderComponent(
        runtime,
        builder,
        this.#context,
        owner,
        ComponentClass,
        componentArgs
      ),
      env: runtime.env,
    };
  }

  // This should run, at latest, before any additional rendering.
  #destroy() {
    for (const { destroyable, destructor } of this.#destructions) {
      destructor(destroyable);
    }

    for (const callback of this.#finalizers) {
      callback();
    }

    this.#destructions = [];
    this.#finalizers = [];
  }

  didRender(): Promise<void> {
    if (this.#scheduled) {
      return new Promise((resolve, reject) => {
        this.#renderNotifiers.push([resolve, reject]);
      });
    }
    return Promise.resolve();
  }

  renderRoot(component: ComponentDefinition, options: RenderRootOptions) {
    // just in case we haven't destroyed yet
    this.#destroy();

    const { element, args, owner } = options;
    const document = this.#options.document;

    const { env, iterator } = this.#getTemplateIterator(
      component,
      element,
      { document },
      new EnvDelegate({
        interactive: options.interactive ?? true,
        document: element.ownerDocument,
      }),
      args,
      owner,
      options.rehydrate ? this.#deps.runtime.rehydrationBuilder : this.#deps.runtime.clientBuilder
    );
    const result = this.#deps.runtime.renderSync(env, iterator);
    this.#roots.push(result);
    return Promise.resolve(result);
  }

  dropRoot(root: RenderResult) {
    const index = this.#roots.indexOf(root);
    if (index === -1) {
      return;
    }

    this.#roots.splice(index, 1);
    this.#deps.runtime.destroy(root.drop);
  }

  #scheduleRevalidate(): void {
    if (this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    setTimeout(() => {
      this.#scheduled = false;
      try {
        this.#revalidate();
        this.#renderNotifiers.forEach(([resolve]) => resolve());
      } catch (err) {
        this.#renderNotifiers.forEach(([, reject]) => reject(err as Error));
      }

      this.#renderNotifiers = [];
    }, 0);
  }

  #revalidate(): void {
    // just in case we haven't destroyed yet
    this.#destroy();

    for (const root of this.#roots) {
      const { env } = root;
      env.begin();
      root.rerender();
      env.commit();
    }
  }
}

export interface RuntimeOptions {
  document: SimpleDocument | Document;
  deps: Deps;
}

export interface RenderRootOptions {
  element: SimpleElement | Element;
  interactive?: boolean;
  args?: Dict<unknown>;
  owner?: object;
  rehydrate?: boolean;
}
