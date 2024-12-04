import type { Tag } from '@glimmer/interfaces';
import { unwrap } from '@glimmer/debug-util';

import { debug } from './debug';
import { combine, CONSTANT_TAG } from './tag';

/**
 * An object that that tracks @tracked properties that were consumed.
 */
export class Tracker {
  private tags = new Set<Tag>();
  private last: Tag | null = null;

  add(tag: Tag) {
    if (tag === CONSTANT_TAG) return;

    this.tags.add(tag);

    if (import.meta.env.DEV) {
      unwrap(debug.markTagAsConsumed)(tag);
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
      return combine(Array.from(this.tags));
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
let CURRENT_TRACKER: Tracker | null = null;

const OPEN_TRACK_FRAMES: (Tracker | null)[] = [];

export function beginTrackFrame(debuggingContext?: string | false): void {
  OPEN_TRACK_FRAMES.push(CURRENT_TRACKER);

  CURRENT_TRACKER = new Tracker();

  if (import.meta.env.DEV) {
    unwrap(debug.beginTrackingTransaction)(debuggingContext);
  }
}

export function endTrackFrame(): Tag {
  let current = CURRENT_TRACKER;

  if (import.meta.env.DEV) {
    if (OPEN_TRACK_FRAMES.length === 0) {
      throw new Error('attempted to close a tracking frame, but one was not open');
    }

    unwrap(debug.endTrackingTransaction)();
  }

  CURRENT_TRACKER = OPEN_TRACK_FRAMES.pop() || null;

  return unwrap(current).combine();
}

export function beginUntrackFrame(): void {
  OPEN_TRACK_FRAMES.push(CURRENT_TRACKER);
  CURRENT_TRACKER = null;
}

export function endUntrackFrame(): void {
  if (import.meta.env.DEV && OPEN_TRACK_FRAMES.length === 0) {
    throw new Error('attempted to close a tracking frame, but one was not open');
  }

  CURRENT_TRACKER = OPEN_TRACK_FRAMES.pop() || null;
}

// This function is only for handling errors and resetting to a valid state
export function resetTracking(): string | void {
  while (OPEN_TRACK_FRAMES.length > 0) {
    OPEN_TRACK_FRAMES.pop();
  }

  CURRENT_TRACKER = null;

  if (import.meta.env.DEV) {
    return unwrap(debug.resetTrackingTransaction)();
  }
}

export function isTracking(): boolean {
  return CURRENT_TRACKER !== null;
}

export function consumeTag(tag: Tag): void {
  if (CURRENT_TRACKER !== null) {
    CURRENT_TRACKER.add(tag);
  }
}
