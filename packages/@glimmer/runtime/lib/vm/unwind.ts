import type {
  Result,
  TargetState,
  UnwindTarget as UnwindTargetInterface,
} from '@glimmer/interfaces';

import { Ok } from '@glimmer/util';

export class UnwindTarget implements UnwindTargetInterface {
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

  get handler() {
    return this.#target.handler;
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
