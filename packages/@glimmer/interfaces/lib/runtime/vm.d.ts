import type { Destroyable, Nullable } from '../core';
import type { GlimmerTreeChanges } from '../dom/changes';
import type { SomeReactive } from '../references';
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
  getSelf(): SomeReactive;
  associateDestroyable(child: Destroyable): void;
}

export interface HandleException {
  readonly handler: ExceptionHandler;
  /**
   * If true, unwinding should stop at this frame.
   */
  readonly unwind: boolean;
}

export interface UpdatingVM {
  env: Environment;
  dom: GlimmerTreeChanges;
  alwaysRevalidate: boolean;

  execute(opcodes: UpdatingOpcode[], handler: ExceptionHandler): void;
  goto(index: number): void;
  try(ops: UpdatingOpcode[], error: Nullable<HandleException>): void;
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
