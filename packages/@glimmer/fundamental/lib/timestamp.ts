export type Revision = number;

export const CONSTANT: Revision = 0;
export const INITIAL: Revision = 1;

let $REVISION: Revision = INITIAL;

/**
 * Increments the revision counter and returns the next revision.
 */
export function bump(): Revision {
  return ++$REVISION;
}

/**
 * Returns the current revision without changing it.
 */
export function now(): Revision {
  return $REVISION;
}
