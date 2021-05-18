import { DEBUG } from '@glimmer/env';
import { deprecate, assert } from '@glimmer/global-context';
import { SourceImpl } from './cache';

export let beginTrackingTransaction:
  | undefined
  | ((debuggingContext?: string | false, deprecate?: boolean) => void);
export let endTrackingTransaction: undefined | (() => void);
export let runInTrackingTransaction:
  | undefined
  | (<T>(fn: () => T, debuggingContext?: string | false) => T);
export let deprecateMutationsInTrackingTransaction: undefined | ((fn: () => void) => void);

export let resetTrackingTransaction: undefined | (() => string);

export let assertCacheNotConsumed: undefined | ((cache: SourceImpl) => void);
export let markCacheAsConsumed: undefined | ((cache: SourceImpl) => void);
export let logTrackingStack: undefined | ((transaction?: Transaction) => string);

interface Transaction {
  parent: Transaction | null;
  debugLabel?: string;
  deprecate: boolean;
}

if (DEBUG) {
  let CONSUMED_TAGS: WeakMap<SourceImpl, Transaction> | null = null;

  let TRANSACTION_STACK: Transaction[] = [];

  beginTrackingTransaction = (_debugLabel?: string | false, deprecate = false) => {
    CONSUMED_TAGS = CONSUMED_TAGS || new WeakMap();

    let debugLabel = _debugLabel || undefined;

    let parent = TRANSACTION_STACK[TRANSACTION_STACK.length - 1] || null;

    TRANSACTION_STACK.push({
      parent,
      debugLabel,
      deprecate,
    });
  };

  endTrackingTransaction = () => {
    if (TRANSACTION_STACK.length === 0) {
      throw new Error('attempted to close a tracking transaction, but one was not open');
    }

    TRANSACTION_STACK.pop();

    if (TRANSACTION_STACK.length === 0) {
      CONSUMED_TAGS = null;
    }
  };

  resetTrackingTransaction = () => {
    let stack = '';

    if (TRANSACTION_STACK.length > 0) {
      stack = logTrackingStack!(TRANSACTION_STACK[TRANSACTION_STACK.length - 1]);
    }

    TRANSACTION_STACK = [];
    CONSUMED_TAGS = null;

    return stack;
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
  runInTrackingTransaction = <T>(fn: () => T, debugLabel?: string | false) => {
    beginTrackingTransaction!(debugLabel);
    let didError = true;

    try {
      let value = fn();
      didError = false;
      return value;
    } finally {
      if (didError !== true) {
        endTrackingTransaction!();
      }
    }
  };

  /**
   * Switches to deprecating within an autotracking transaction, if one exists.
   * If `runInAutotrackingTransaction` is called within the callback of this
   * method, it switches back to throwing an error, allowing zebra-striping of
   * the types of errors that are thrown.
   *
   * Does not start an autotracking transaction.
   *
   * NOTE: For Ember usage only, in general you should assert that these
   * invariants are true.
   */
  deprecateMutationsInTrackingTransaction = (fn: () => void, debugLabel?: string | false) => {
    beginTrackingTransaction!(debugLabel, true);

    try {
      fn();
    } finally {
      endTrackingTransaction!();
    }
  };

  let nthIndex = (str: string, pattern: string, n: number, startingPos = -1) => {
    let i = startingPos;

    while (n-- > 0 && i++ < str.length) {
      i = str.indexOf(pattern, i);
      if (i < 0) break;
    }

    return i;
  };

  let makeTrackingErrorMessage = <T>(transaction: Transaction, cache: SourceImpl<T>) => {
    const debugLabel = cache.debuggingContext
      ? cache.debuggingContext
      : 'an unknown/unlabeled storage';

    return [
      `You attempted to update the storage for ${debugLabel}, but it had already been used previously in the same computation.  Attempting to update a value after using it in a computation can cause logical errors, infinite revalidation bugs, and performance issues, and is not supported.`,

      `\`${debugLabel}\` was first used:`,

      logTrackingStack!(transaction),

      `Stack trace for the update:`,
    ].join('\n\n');
  };

  logTrackingStack = (transaction?: Transaction) => {
    let trackingStack = [];
    let current: Transaction | null | undefined =
      transaction || TRANSACTION_STACK[TRANSACTION_STACK.length - 1];

    if (current === undefined) return '';

    while (current) {
      if (current.debugLabel) {
        trackingStack.unshift(current.debugLabel);
      }

      current = current.parent;
    }

    // TODO: Use String.prototype.repeat here once we can drop support for IE11
    return trackingStack.map((label, index) => Array(2 * index + 1).join(' ') + label).join('\n');
  };

  markCacheAsConsumed = (cache: SourceImpl) => {
    if (!CONSUMED_TAGS || CONSUMED_TAGS.has(cache)) return;

    CONSUMED_TAGS.set(cache, TRANSACTION_STACK[TRANSACTION_STACK.length - 1]);

    // We need to mark the tag and all of its subtags as consumed, for computed
    // properties and observers
    if (Array.isArray(cache.deps)) {
      cache.deps.forEach(markCacheAsConsumed!);
    } else if (cache.deps) {
      markCacheAsConsumed!(cache.deps);
    }
  };

  assertCacheNotConsumed = (cache: SourceImpl) => {
    if (CONSUMED_TAGS === null) return;

    let transaction = CONSUMED_TAGS.get(cache);

    if (!transaction) return;

    let currentTransaction = TRANSACTION_STACK[TRANSACTION_STACK.length - 1];

    if (currentTransaction.deprecate) {
      deprecate(makeTrackingErrorMessage(transaction, cache), false, {
        id: 'autotracking.mutation-after-consumption',
      });
    } else {
      // This hack makes the assertion message nicer, we can cut off the first
      // few lines of the stack trace and let users know where the actual error
      // occurred.
      try {
        assert(false, makeTrackingErrorMessage(transaction, cache));
      } catch (e) {
        if (e.stack) {
          let updateStackBegin = e.stack.indexOf('Stack trace for the update:');

          if (updateStackBegin !== -1) {
            let start = nthIndex(e.stack, '\n', 1, updateStackBegin);
            let end = nthIndex(e.stack, '\n', 4, updateStackBegin);
            e.stack = e.stack.substr(0, start) + e.stack.substr(end);
          }
        }

        throw e;
      }
    }
  };
}
