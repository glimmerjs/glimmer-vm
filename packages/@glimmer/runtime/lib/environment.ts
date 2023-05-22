import type {
  AppendOperations,
  ComponentInstanceWithCreate,
  Environment,
  EnvironmentOptions,
  GlimmerTreeChanges,
  ModifierInstance,
  Nullable,
  RuntimeArtifacts,
  RuntimeContext,
  RuntimeResolver,
  Transaction,
  TransactionSymbol,
} from '@glimmer/interfaces';
import { RuntimeProgramImpl } from '@glimmer/program';
import { assert, expect } from '@glimmer/util';
import { track, updateTag } from '@glimmer/validator';

import DebugRenderTree from './debug-render-tree';
import { DOMChangesImpl } from './dom/helper';
import { TreeConstruction } from './dom/tree-builder';

export const TRANSACTION: TransactionSymbol = Symbol('TRANSACTION') as TransactionSymbol;

class TransactionImpl implements Transaction {
  public scheduledInstallModifiers: ModifierInstance[] = [];
  public scheduledUpdateModifiers: ModifierInstance[] = [];
  public createdComponents: ComponentInstanceWithCreate[] = [];
  public updatedComponents: ComponentInstanceWithCreate[] = [];

  didCreate(component: ComponentInstanceWithCreate) {
    this.createdComponents.push(component);
  }

  didUpdate(component: ComponentInstanceWithCreate) {
    this.updatedComponents.push(component);
  }

  scheduleInstallModifier(modifier: ModifierInstance) {
    this.scheduledInstallModifiers.push(modifier);
  }

  scheduleUpdateModifier(modifier: ModifierInstance) {
    this.scheduledUpdateModifiers.push(modifier);
  }

  commit() {
    let { createdComponents, updatedComponents } = this;

    for (let { manager, state } of createdComponents) {
      manager.didCreate(state);
    }

    for (let { manager, state } of updatedComponents) {
      manager.didUpdate(state);
    }

    let { scheduledInstallModifiers, scheduledUpdateModifiers } = this;

    for (let { manager, state, definition } of scheduledInstallModifiers) {
      let modifierTag = manager.getTag(state);

      if (modifierTag === null) {
        manager.install(state);
      } else {
        let tag = track(
          () => manager.install(state),
          import.meta.env.DEV &&
            `- While rendering:\n  (instance of a \`${
              definition.resolvedName || manager.getDebugName(definition.state)
            }\` modifier)`
        );
        updateTag(modifierTag, tag);
      }
    }

    for (let { manager, state, definition } of scheduledUpdateModifiers) {
      let modifierTag = manager.getTag(state);

      if (modifierTag === null) {
        manager.update(state);
      } else {
        let tag = track(
          () => manager.update(state),
          import.meta.env.DEV &&
            `- While rendering:\n  (instance of a \`${
              definition.resolvedName || manager.getDebugName(definition.state)
            }\` modifier)`
        );
        updateTag(modifierTag, tag);
      }
    }
  }
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

  scheduleInstallModifier(modifier: ModifierInstance) {
    if (this.isInteractive) {
      this.transaction.scheduleInstallModifier(modifier);
    }
  }

  scheduleUpdateModifier(modifier: ModifierInstance) {
    if (this.isInteractive) {
      this.transaction.scheduleUpdateModifier(modifier);
    }
  }

  commit() {
    let transaction = this.transaction;
    this[TRANSACTION] = null;
    transaction.commit();

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
