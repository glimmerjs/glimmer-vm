import type { Destroyable, Nullable } from '../core';
import type { GlimmerTreeChanges } from '../dom/changes';
import type { MutableReactiveCell, Reactive } from '../references';
import type { Result } from '../result';
import type { Environment } from './environment';
import type { Owner } from './owner';
import type { ExceptionHandler } from './render';
import type { DynamicScope } from './scope';
/**
 * This is used in the Glimmer Embedding API. In particular, embeddings provide helpers through the
 * `CompileTimeLookup` interface, and the helpers they provide implement the `Helper` interface,
 * which is a function that takes a `VM` as a parameter.
 */
export interface VM<O extends Owner = Owner> {
  env: Environment;
  readonly dynamicScope: DynamicScope;

  getOwner(): O;
  getSelf(): Reactive;
  associateDestroyable(child: Destroyable): void;
}

export interface CatchState {
  isTryFrame: boolean;
  handler: Nullable<ErrorHandler>;
  error: MutableReactiveCell<number>;
}

export interface HandleException {
  readonly handler: ExceptionHandler;
  /**
   * If present, unwinding should stop at this frame.
   */
  readonly unwind: Nullable<CatchState>;
}

export interface UpdatingVM {
  env: Environment;
  dom: GlimmerTreeChanges;
  alwaysRevalidate: boolean;

  execute(opcodes: UpdatingOpcode[], handler: ExceptionHandler): void;
  goto(index: number): void;
  try(ops: UpdatingOpcode[], error: Nullable<HandleException>): void;
  unwind(): void;
  throw(): void;
}

export interface UpdatingOpcode {
  evaluate(vm: UpdatingVM): void;
  debug?: unknown;
}

export interface TargetState {
  ip: number;
  ra: number;
  fp: number;
  handler: ErrorHandler | null;
  error: MutableReactiveCell<number>;
}

export type ErrorHandler = (error: unknown, retry: () => void) => Result<void>;

export interface UnwindTarget {
  child(state: TargetState): UnwindTarget;

  finally(): UnwindTarget | null;

  catch(error: unknown): TargetState;

  /**
   * Returns the error caught by the VM, but only if it hasn't been handled.
   */
  get unhandled(): Result<void>;
}
