import type { DebugRenderTree, Destroyable, Destructor } from '@glimmer/interfaces';
import type { EnvironmentDelegate } from '@glimmer/runtime';

import type { EnvRuntimeOptions } from './index';

/**
 * The environment delegate base class shared by both the client and SSR
 * environments. Contains shared definitions, but requires user to specify
 * `isInteractive` and a method for getting the protocols of URLs.
 *
 * @internal
 */
export class EnvDelegate implements EnvironmentDelegate {
  readonly isInteractive: boolean;

  enableDebugTooling: boolean;

  constructor(options: EnvRuntimeOptions) {
    this.isInteractive = options.interactive ?? true;
    this.enableDebugTooling = options.debug ?? false;
  }

  onTransactionCommit(): void {}
}

export interface Destruction {
  destroyable: Destroyable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  destructor: Destructor<any>;
}

export type Finalize = () => void;

/**
 * Only a single global environment can exist in the context of a single
 * global. This is because the core reactive operations are module-scoped
 * functions and interact with the global environment that is exposed via
 * another module.
 *
 * Note: The low-level Glimmer VM has a callback that runs when a root's
 * transaction is done rendering, but it is not used by Ember, and is
 * generally not necessary, so it's omitted from this interface.
 */
export interface GlobalEnvironment {
  /**
   * Notify the global environment that a mutation occurred. The environment typically uses the
   * notification to schedule an asynchronous revalidation of any rendered content.
   *
   * A global environment must call all destructors passed to
   * {@linkcode GlobalEnvironment.scheduleDestroy | scheduleDestroy} and all finalizers passed
   * to {@linkcode GlobalEnvironment.scheduleFinalize | scheduleFinalize} before revalidating
   * any roots.
   */
  didMutate: () => void;

  // didRenderRoot: (root: RenderRoot) => void;

  /**
   * Notifies the global environment that a particular object is being destroyed, and that the
   * supplied destructor needs to run.
   *
   * Environments may (and usually do) schedule the destruction, but the following invariants must
   * hold:
   *
   * 1. all destructors must be called before any callbacks passed to `didDestroy` are called.
   * 2. all `didDestroy` callbacks must be called before starting a new render transaction
   *    (scheduled by the global environment in response to `didMutate`)
   *
   * In practice `destroy` and `finalize` are used to coordinate destruction across a tree of
   * objects. When destroy() is called:
   *
   * 1. Mark the destroyable and all of its descendants as destroying.
   * 2. Call any destructors registered as _eager_. This happens synchronously in the implementation
   *    of `@glimmer/destroyable`.
   * 3. Call {@linkcode GlobalEnvironment.scheduleDestroy | scheduleDestroy} (`destroy`) for each
   *    destructor in this object and its descendants.
   *    {@linkcode GlobalEnvironment.scheduleDestroy | scheduleDestroy} is called in a bottom-up
   *    order: First, it is called with the destructors of objects with no children. Then, it is
   *    called with the destructors of the parents of those objects. The process continues until
   *    the object passed to `destroy()` is reached.
   * 4. Call {@linkcode GlobalEnvironment.scheduleFinalize | scheduleFinalize} in the same order
   *    as `scheduleDestroy`. The callback passed to `scheduleDestroy` finalizes the destruction.
   *    This means that the entire tree of objects is in the destroying state until all of their
   *    destructors are called. Once all of the destructors are called, the finalization functions
   *    atomically transitions all of the objects into the `destroyed` state.
   *
   * This is described in https://rfcs.emberjs.com/id/0580-destroyables/
   *
   * The invariants described above are intended to produce the atomic behavior described in RFC
   * 580.
   */
  scheduleDestroy: <T extends object>(destroyable: T, destructor: Destructor<T>) => void;

  /**
   * Provides the global environment with a callback to run once all scheduled destructors
   * passed in {@linkcode GlobalEnvironment.scheduleFinalize | scheduleFinalize} are run.
   *
   * When this callback is called, the destroyed object and all of its descendents will
   * move into the `destroyed` state atomically.
   *
   * See {@linkcode GlobalEnvironment.scheduleDestroy | scheduleDestroy} for a complete
   * description of the algorithm.
   */
  scheduleFinalize: (callback: () => void) => void;
}

/**
 * Each root can have a different environment. This means that you can configure
 * the behavior defined by `RootEnvironment` differently within the context of
 * a single page.
 *
 * For example, you could implement a pure Glimmer SSR demo in the
 * context of an Ember app.
 */
export interface RootEnvironment {
  /**
   * If a root environment is not interactive, element modifiers will not be installed.
   */
  readonly interactive: boolean;

  /**
   * If a root environment provides a `setDebugRenderTree` callback, it is called with
   * an instance of {@linkcode DebugRenderTree}. The `DebugRenderTree` is a stable
   * object that is updated
   */
  setDebugRenderTree?(tree: DebugRenderTree): void;
}

export class GlobalContextDelegate {}

// export class ListGlobalEnvironment implements GlobalEnvironment {
//   #destructions: Destruction[] = [];
//   #finalizers: Finalize[] = [];
//   #roots: RenderRoot[] = [];

//   didMutate = (): void => {};

//   scheduleDestroy = <T extends object>(destroyable: T, destructor: Destructor<T>): void => {
//     this.#destructions.push({ destroyable, destructor });
//   };

//   scheduleFinalize = (callback: () => void): void => {
//     this.#finalizers.push(callback);
//   };

//   didRenderRoot = (root: RenderRoot): void => {
//     this.#roots.push(root);
//   };

//   destroy(destruction: Destruction) {
//     this.#destruction.push(destruction);
//   }

//   destroyed(callback: Finalize) {
//     this.#finish.push(callback);
//   }

//   commit() {
//     for (const { destroyable, destructor } of this.#destruction) {
//       destructor(destroyable);
//     }

//     for (const finish of this.#finish) {
//       finish();
//     }

//     this.#destruction = [];
//     this.#finish = [];
//   }
// }
