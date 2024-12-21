import type { Revision } from '@glimmer/state';
import { clock } from '@glimmer/state';

/**
 * Increments the revision counter and returns the next revision.
 */
export function bump(): Revision {
  return ++clock.now;
}

/**
 * Returns the current revision without changing it.
 */
export function now(): Revision {
  return clock.now;
}
