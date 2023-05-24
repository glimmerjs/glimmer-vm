import type {
  AppendOperations,
  ComponentInstanceWithCreate,
  Destroyable,
  Environment,
  EnvironmentOptions,
  GlimmerTreeChanges,
  InstallableModifier,
  Nullable,
  RuntimeArtifacts,
  RuntimeContext,
  RuntimeResolver,
  Transaction,
  TransactionSymbol,
} from '@glimmer/interfaces';
import { RuntimeProgramImpl } from '@glimmer/program';
import { assert, expect } from '@glimmer/util';

import DebugRenderTree from './debug-render-tree';
import { DOMChangesImpl } from './dom/helper';
import { TreeConstruction } from './dom/tree-builder';
import { associateDestroyableChild } from '@glimmer/destroyable';

export const TRANSACTION: TransactionSymbol = Symbol('TRANSACTION') as TransactionSymbol;

type QueuedModifier = [modifier: InstallableModifier, parent: Destroyable];

class TransactionImpl implements Transaction {
  #flushedModifiers: WeakMap<Element, QueuedModifier[]> = new WeakMap();
  #scheduledInstallModifiers: QueuedModifier[] = [];
  #scheduledUpdateModifiers: InstallableModifier[] = [];

  #createdComponents: ComponentInstanceWithCreate[] = [];
  #updatedComponents: ComponentInstanceWithCreate[] = [];

  didCreate(component: ComponentInstanceWithCreate) {
    this.#createdComponents.push(component);
  }

  didUpdate(component: ComponentInstanceWithCreate) {
    this.#updatedComponents.push(component);
  }

  didAppend(element: Element) {
    let queuedModifiers = this.#flushedModifiers.get(element);

    if (queuedModifiers) {
      for (let [modifier, parent] of queuedModifiers) {
        this.#scheduledInstallModifiers.push([modifier, parent]);
      }
      this.#flushedModifiers.delete(element);
    }
  }

  scheduleInstallModifier(modifier: InstallableModifier, parent: object) {
    let element = modifier.element;

    let queuedModifiers = this.#flushedModifiers.get(element);

    if (queuedModifiers === undefined) {
      queuedModifiers = [];
      this.#flushedModifiers.set(element, queuedModifiers);
    }

    queuedModifiers.push([modifier, parent]);
  }

  scheduleUpdateModifier(modifier: InstallableModifier) {
    this.#scheduledUpdateModifiers.push(modifier);
  }

  commit(env: Environment) {
    for (let { manager, state } of this.#createdComponents) {
      manager.didCreate(state);
    }

    for (let { manager, state } of this.#updatedComponents) {
      manager.didUpdate(state);
    }

    for (let [modifier, parent] of this.#scheduledInstallModifiers) {
      modifier.render();
      associateDestroyableChild(parent, modifier);
    }

    for (let modifier of this.#scheduledUpdateModifiers) {
      modifier.update(env);
      // let modifierTag = manager.getTag(state);
      // if (modifierTag === null) {
      //   manager.update(state);
      // } else {
      //   let tag = track(
      //     () => manager.update(state),
      //     import.meta.env.DEV &&
      //       `- While rendering:\n  (instance of a \`${
      //         definition.resolvedName || manager.getDebugName(definition.state)
      //       }\` modifier)`
      //   );
      //   updateTag(modifierTag, tag);
      // }
    }
  }
}

const DOCUMENT_POSITION_DISCONNECTED = 1;
const DOCUMENT_POSITION_PRECEDING = 2;
const DOCUMENT_POSITION_FOLLOWING = 4;
const DOCUMENT_POSITION_CONTAINS = 8;
const DOCUMENT_POSITION_CONTAINED_BY = 16;
const DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32;

function sortModifiers(modifiers: InstallableModifier[]) {
  // sort by document containment:
  // - bottom to top
  // - left to right
  //
  // each modifier has an `element` property

  return modifiers.sort((a, b) => {
    let aElement = a.element;
    let bElement = b.element;
    let compare = aElement.compareDocumentPosition(bElement);

    if (compare & DOCUMENT_POSITION_CONTAINS) {
      return -1;
    }

    if (compare & DOCUMENT_POSITION_CONTAINED_BY) {
      return 1;
    }

    if (compare & DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }

    if (compare & DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }

    return 0;
  });
}

export class EnvironmentImpl implements Environment {
  [TRANSACTION]: Nullable<TransactionImpl> = null;

  readonly getAppendOperations: AppendOperations;
  protected updateOperations?: GlimmerTreeChanges | undefined;

  // Delegate methods and values
  public isInteractive: boolean;

  debugRenderTree: DebugRenderTree<object> | undefined;
  readonly #delegate: EnvironmentDelegate;

  constructor(options: EnvironmentOptions, delegate: EnvironmentDelegate) {
    this.#delegate = delegate;
    this.isInteractive = delegate.isInteractive;
    this.debugRenderTree = this.#delegate.enableDebugTooling ? new DebugRenderTree() : undefined;

    if (import.meta.env && !options.appendOperations && !options.document) {
      throw new Error('you must pass document or appendOperations to a new runtime');
    }

    this.getAppendOperations =
      options.appendOperations ?? ((cursor) => TreeConstruction._forCursor_(cursor));
    this.updateOperations =
      options.updateOperations ?? new DOMChangesImpl(options.document as unknown as Document);
  }

  getDOM(): GlimmerTreeChanges {
    return expect(
      this.updateOperations,
      'Attempted to get DOM updateOperations, but they were not provided by the environment. You may be attempting to rerender in an environment which does not support rerendering, such as SSR.'
    );
  }

  begin() {
    assert(
      !this[TRANSACTION],
      'A glimmer transaction was begun, but one already exists. You may have a nested transaction, possibly caused by an earlier runtime exception while rendering. Please check your console for the stack trace of any prior exceptions.'
    );

    this.debugRenderTree?.begin();

    this[TRANSACTION] = new TransactionImpl();
  }

  // FIXME: This is used for stubbing in env-test
  private get transaction(): TransactionImpl {
    return expect(this[TRANSACTION]!, 'must be in a transaction');
  }

  didCreate(component: ComponentInstanceWithCreate) {
    this.transaction.didCreate(component);
  }

  didUpdate(component: ComponentInstanceWithCreate) {
    this.transaction.didUpdate(component);
  }

  didAppend(element: Element): void {
    if (this.isInteractive) {
      this.transaction.didAppend(element);
    }
  }

  scheduleInstallModifier(modifier: InstallableModifier, parent: Destroyable) {
    if (this.isInteractive) {
      this.transaction.scheduleInstallModifier(modifier, parent);
    }
  }

  scheduleUpdateModifier(modifier: InstallableModifier) {
    if (this.isInteractive) {
      this.transaction.scheduleUpdateModifier(modifier);
    }
  }

  commit() {
    let transaction = this.transaction;
    this[TRANSACTION] = null;
    transaction.commit(this);

    this.debugRenderTree?.commit();

    this.#delegate.onTransactionCommit();
  }
}

export interface EnvironmentDelegate {
  /**
   * Used to determine the the environment is interactive (e.g. SSR is not
   * interactive). Interactive environments schedule modifiers, among other things.
   */
  isInteractive: boolean;

  /**
   * Used to enable debug tooling
   */
  enableDebugTooling: boolean;

  /**
   * Callback to be called when an environment transaction commits
   */
  onTransactionCommit: () => void;
}

export function runtimeContext(
  options: EnvironmentOptions,
  delegate: EnvironmentDelegate,
  artifacts: RuntimeArtifacts,
  resolver: RuntimeResolver
): RuntimeContext {
  return {
    env: new EnvironmentImpl(options, delegate),
    program: new RuntimeProgramImpl(artifacts.constants, artifacts.heap),
    resolver: resolver,
  };
}

export function inTransaction(environment: Environment, block: () => void): void {
  if (environment[TRANSACTION]) {
    block();
  } else {
    environment.begin();
    try {
      block();
    } finally {
      environment.commit();
    }
  }
}

export default EnvironmentImpl;
