import type { Result } from '@glimmer/interfaces';

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

  get error(): Result<void> {
    return this.#error;
  }
}
