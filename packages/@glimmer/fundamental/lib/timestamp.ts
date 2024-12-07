import type { Revision } from '@glimmer/interfaces';
import state from '@glimmer/state';

/**
 * Increments the revision counter and returns the next revision.
 */
export function bump(): Revision {
  return ++state.clock.now;
}

/**
 * Returns the current revision without changing it.
 */
export function now(): Revision {
  return state.clock.now;
}
