import type { DebugTransaction, Tag } from '@glimmer/state';
import { unwrap } from '@glimmer/debug-util';
import { tracking } from '@glimmer/state';

import { combineTags, CONSTANT_TAG, isConstTag } from './tag';

type Optional<T> = T | undefined;

let trackingDebug: Optional<DebugTransaction>;

export const setTrackingDebug: Optional<(debug: DebugTransaction) => void> = import.meta.env.DEV
  ? (d) => (trackingDebug = d)
  : undefined;

export const getTrackingDebug: (() => DebugTransaction) | undefined = import.meta.env.DEV
  ? () => trackingDebug as DebugTransaction
  : undefined;

/**
 * An object that that tracks @tracked properties that were consumed.
 */
class Tracker {
  private tags = new Set<Tag>();
  private last: Tag | null = null;

  add(tag: Tag) {
    if (tag === CONSTANT_TAG || isConstTag(tag)) return;

    this.tags.add(tag);

    if (import.meta.env.DEV) {
      unwrap(trackingDebug).markTagAsConsumed(tag);
    }

    this.last = tag;
  }

  combine(): Tag {
    let { tags } = this;

    if (tags.size === 0) {
      return CONSTANT_TAG;
    } else if (tags.size === 1) {
      return this.last as Tag;
    } else {
      return combineTags(Array.from(this.tags));
    }
  }
}

/**
 * Whenever a tracked computed property is entered, the current tracker is
 * saved off and a new tracker is replaced.
 *
 * Any tracked properties consumed are added to the current tracker.
 *
 * When a tracked computed property is exited, the tracker's tags are
 * combined and added to the parent tracker.
 *
 * The consequence is that each tracked computed property has a tag
 * that corresponds to the tracked properties consumed inside of
 * itself, including child tracked computed properties.
 */

export function beginTrackFrame(debuggingContext?: string | false): void {
  tracking.stack.push(tracking.current);

  tracking.current = new Tracker();

  if (import.meta.env.DEV) {
    unwrap(trackingDebug).beginTrackingTransaction(debuggingContext);
  }
}

export function endTrackFrame(): Tag {
  let current = tracking.current;

  if (import.meta.env.DEV) {
    if (tracking.stack.length === 0) {
      throw new Error('attempted to close a tracking frame, but one was not open');
    }

    unwrap(trackingDebug).endTrackingTransaction();
  }

  tracking.current = tracking.stack.pop() || null;

  return unwrap(current).combine();
}

export function beginUntrackFrame(): void {
  tracking.stack.push(tracking.current);
  tracking.current = null;
}

export function endUntrackFrame(): void {
  if (import.meta.env.DEV && tracking.stack.length === 0) {
    throw new Error('attempted to close a tracking frame, but one was not open');
  }

  tracking.current = tracking.stack.pop() || null;
}

// This function is only for handling errors and resetting to a valid state
export function resetTracking(): string | void {
  while (tracking.stack.length > 0) {
    tracking.stack.pop();
  }

  tracking.current = null;

  if (import.meta.env.DEV) {
    return unwrap(trackingDebug).resetTrackingTransaction();
  }
}

export function isTracking(): boolean {
  return tracking.current !== null;
}

export function consumeTag(tag: Tag): void {
  if (tracking.current !== null) {
    tracking.current.add(tag);
  }
}
