import type {
  DebugState,
  DebugTransaction,
  DebugTransactionFrame,
  Tag,
  TransactionEnv,
} from '@glimmer/state';
import { asPresentArray, getLast, unwrap } from '@glimmer/debug-util';
import { setTrackingDebug } from '@glimmer/fundamental';
import { assert } from '@glimmer/global-context';
import { debug as _debug } from '@glimmer/state';

const debug = unwrap(_debug);

/**
 * This function should collapse down to nothing, inline as `true`, and
 * disappear entirely in production.
 */
export function allowsCycles(tag: Tag): boolean {
  if (import.meta.env.DEV) {
    return debug.cycleMap.has(tag);
  }

  return true;
}

export function allowCycles(tag: Tag): void {
  if (import.meta.env.DEV) {
    debug.cycleMap.set(tag, true);
  }
}

//// DebugTransaction ////

let helpers: DebugTransaction | undefined;

if (import.meta.env.DEV) {
  // This section should really be moved into globalContext, since it's a big chunk of code
  // to include in a package that is supposed to remain stable enough to avoid major
  // version bumps.
  debug.env.debugMessage ??= (obj?: unknown, keyName?: string) => {
    let objName;

    if (typeof obj === 'function') {
      objName = obj.name;
    } else if (typeof obj === 'object' && obj !== null) {
      let className = (obj.constructor && obj.constructor.name) || '(unknown class)';

      objName = `(an instance of ${className})`;
    } else if (obj === undefined) {
      objName = '(an unknown tag)';
    } else if (obj === null) {
      objName = '(null)';
    } else {
      objName = `(${typeof obj})`;
    }

    let dirtyString = keyName ? `\`${keyName}\` on \`${objName}\`` : `\`${objName}\``;

    return `You attempted to update ${dirtyString}, but it had already been used previously in the same computation.  Attempting to update a value after using it in a computation can cause logical errors, infinite revalidation bugs, and performance issues, and is not supported.`;
  };

  /**
   * This class uses the shared state to create a transaction helpers object that
   * can be used to create and close tracking transactions.
   *
   * That allows this package to be used as a utility package without having to
   */
  class DebugTransactionHelpers implements DebugTransaction {
    #state: DebugState;

    constructor(state: DebugState) {
      this.#state = state;
    }

    setTrackingTransactionEnv = (env: TransactionEnv): void => {
      this.#state.env = env;
    };

    beginTrackingTransaction = (_debugLabel?: string | false, _deprecate?: boolean): void => {
      this.#state.consumed ??= new WeakMap();

      let debugLabel = _debugLabel || undefined;

      let parent = this.#state.stack.at(-1) ?? null;

      this.#state.stack.push({
        parent,
        debugLabel,
      });
    };

    endTrackingTransaction = (): void => {
      if (this.#state.stack.length === 0) {
        throw new Error('attempted to close a tracking transaction, but one was not open');
      }

      this.#state.stack.pop();

      if (this.#state.stack.length === 0) {
        this.#state.consumed = null;
      }
    };

    /**
     * Creates a global autotracking transaction. This will prevent any backflow
     * in any `track` calls within the transaction, even if they are not
     * externally consumed.
     *
     * `runInAutotrackingTransaction` can be called within itself, and it will add
     * onto the existing transaction if one exists.
     *
     * TODO: Only throw an error if the `track` is consumed.
     */
    runInTrackingTransaction = <T>(fn: () => T, debugLabel?: string | false): T => {
      this.beginTrackingTransaction(debugLabel);
      let didError = true;

      try {
        let value = fn();
        didError = false;
        return value;
      } finally {
        if (didError !== true) {
          this.endTrackingTransaction();
        }

        // if (id !== TRANSACTION_STACK.length) {
        //   throw new Error(
        //     `attempted to close a tracking transaction (${id}), but it was not the last transaction (${TRANSACTION_STACK.length})`
        //   );
        // }
      }
    };

    #nthIndex(str: string, pattern: string, n: number, startingPos = -1): number {
      let i = startingPos;

      while (n-- > 0 && i++ < str.length) {
        i = str.indexOf(pattern, i);
        if (i < 0) break;
      }

      return i;
    }

    #makeTrackingErrorMessage<T>(
      transaction: DebugTransactionFrame,
      obj?: T,
      keyName?: keyof T | string | symbol
    ): string {
      let message = [this.#state.env.debugMessage?.(obj, keyName && String(keyName))];

      message.push(`\`${String(keyName)}\` was first used:`);

      message.push(this.logTrackingStack(transaction));

      message.push(`Stack trace for the update:`);

      return message.join('\n\n');
    }

    resetTrackingTransaction = (): string => {
      let stackString = '';

      if (this.#state.stack.length > 0) {
        stackString = this.logTrackingStack(this.#state.stack.at(-1));
      }

      this.#state.stack.splice(0, this.#state.stack.length);
      this.#state.consumed = null;

      return stackString;
    };

    assertTagNotConsumed = <T>(tag: Tag, obj?: T, keyName?: keyof T | string | symbol): void => {
      if (this.#state.consumed === null) return;

      let transaction = this.#state.consumed.get(tag);

      if (!transaction) return;

      // This hack makes the assertion message nicer, we can cut off the first
      // few lines of the stack trace and let users know where the actual error
      // occurred.
      try {
        assert(false, this.#makeTrackingErrorMessage(transaction, obj, keyName));
      } catch (e) {
        if (hasStack(e)) {
          let updateStackBegin = e.stack.indexOf('Stack trace for the update:');

          if (updateStackBegin !== -1) {
            let start = this.#nthIndex(e.stack, '\n', 1, updateStackBegin);
            let end = this.#nthIndex(e.stack, '\n', 4, updateStackBegin);
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            e.stack = e.stack.substr(0, start) + e.stack.substr(end);
          }
        }

        throw e;
      }
    };
    markTagAsConsumed = (_tag: Tag): void => {
      if (!this.#state.consumed || this.#state.consumed.has(_tag)) return;

      this.#state.consumed.set(_tag, getLast(asPresentArray(this.#state.stack)));

      // We need to mark the tag and all of its subtags as consumed, so we need to
      // cast it and access its internals. In the future this shouldn't be necessary,
      // this is only for computed properties.
      let subtag = (_tag as unknown as { subtag: Tag | Tag[] | null }).subtag;

      if (!subtag || !this.markTagAsConsumed) return;

      if (Array.isArray(subtag)) {
        subtag.forEach(this.markTagAsConsumed);
      } else {
        this.markTagAsConsumed(subtag);
      }
    };
    logTrackingStack = (frame?: DebugTransactionFrame): string => {
      let trackingStack = [];
      let current: DebugTransactionFrame | undefined = frame ?? this.#state.stack.at(-1);

      if (current === undefined) return '';

      while (current !== undefined) {
        if (current.debugLabel) {
          trackingStack.unshift(current.debugLabel);
        }

        current = current.parent ?? undefined;
      }

      return trackingStack.map((label, index) => ' '.repeat(2 * index) + label).join('\n');
    };
  }

  // set the default debug environment if this is the first time the fundamental
  // package is being used.
  helpers = new DebugTransactionHelpers(debug);

  unwrap(setTrackingDebug)(helpers);

  function hasStack(error: unknown): error is { stack: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'stack' in error &&
      typeof error.stack === 'string'
    );
  }
}

export { helpers };
