import { DEBUG } from '@glimmer/env';
import {
  Environment,
  EnvironmentOptions,
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  TransactionSymbol,
  RuntimeContext,
  RuntimeResolver,
  RuntimeArtifacts,
  EffectPhase,
} from '@glimmer/interfaces';
import { assert, expect, symbol } from '@glimmer/util';
import { Cache } from '@glimmer/validator';
import { DOMChangesImpl, DOMTreeConstruction } from './dom/helper';
import { RuntimeProgramImpl } from '@glimmer/program';
import DebugRenderTree from './debug-render-tree';
import { EffectsManager } from './effects';

export const TRANSACTION: TransactionSymbol = symbol('TRANSACTION');

export class EnvironmentImpl implements Environment {
  [TRANSACTION] = false;

  protected appendOperations!: GlimmerTreeConstruction;
  protected updateOperations?: GlimmerTreeChanges;

  // Delegate methods and values
  public isInteractive = this.delegate.isInteractive;

  debugRenderTree = this.delegate.enableDebugTooling ? new DebugRenderTree() : undefined;

  private effectManager = new EffectsManager(this.delegate.scheduleEffects);

  constructor(options: EnvironmentOptions, private delegate: EnvironmentDelegate) {
    if (options.appendOperations) {
      this.appendOperations = options.appendOperations;
      this.updateOperations = options.updateOperations;
    } else if (options.document) {
      this.appendOperations = new DOMTreeConstruction(options.document);
      this.updateOperations = new DOMChangesImpl(options.document);
    } else if (DEBUG) {
      throw new Error('you must pass document or appendOperations to a new runtime');
    }
  }

  getAppendOperations(): GlimmerTreeConstruction {
    return this.appendOperations;
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

    this.effectManager.begin();

    this.debugRenderTree?.begin();

    this[TRANSACTION] = true;
  }

  registerEffect(phase: EffectPhase, effect: Cache) {
    this.effectManager.registerEffect(phase, effect);
  }

  commit() {
    this[TRANSACTION] = false;

    this.effectManager.commit();

    this.debugRenderTree?.commit();

    this.delegate.onTransactionCommit();
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
   * Allows the embedding environment to schedule effects to be run in the future.
   * Different phases will be passed to this callback, and each one should be
   * scheduled at an appropriate time for that phase. The callback will be
   * called at the end each transaction.
   *
   * @param phase the phase of effects that are being scheduled
   * @param runEffects the callback which runs the effects
   */
  scheduleEffects: (phase: EffectPhase, runEffects: () => void) => void;

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

export function inTransaction(env: Environment, cb: () => void): void {
  if (!env[TRANSACTION]) {
    env.begin();
    try {
      cb();
    } finally {
      env.commit();
    }
  } else {
    cb();
  }
}

export default EnvironmentImpl;
