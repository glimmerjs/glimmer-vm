import type { Result } from '@glimmer/interfaces';
import { Ok } from '@glimmer/util';

export interface TargetState {
  ip: number;
  ra: number;
  fp: number;
  handler: ErrorHandler | null;
}

export type ErrorHandler = (error: unknown, retry: () => void) => Result<void>;

export class UnwindTarget {
  static root(): UnwindTarget {
    return new UnwindTarget(null, {
      // initial ra
      ip: -1,
      // initial sp
      ra: -1,
      // initial fp
      fp: -1,
      handler: null,
    });
  }

  readonly #parent: UnwindTarget | null;
  readonly #target: TargetState;
  #error: Result<void> = { type: 'ok', value: undefined };

  constructor(parent: UnwindTarget | null, target: TargetState) {
    this.#parent = parent;
    this.#target = target;
  }

  child(state: TargetState): UnwindTarget {
    return new UnwindTarget(this, state);
  }

  finally(): UnwindTarget | null {
    return this.#parent;
  }

  catch(error: unknown): TargetState {
    this.#error = { type: 'err', value: error };
    return this.#target;
  }

  /**
   * Returns the error caught by the VM, but only if it hasn't been handled.
   */
  get unhandled(): Result<void> {
    // If the error is already handled, don't return it.
    if (this.#target.handler) return Ok(undefined);
    return this.#error;
  }
}
