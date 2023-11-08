import type { SomeReactive, Tag } from '@glimmer/interfaces';
import type { Reactive } from './reference';

import { validateTag } from '@glimmer/validator';

/**
 * @internal
 */

export function validateReactive<T>(
  reactive: SomeReactive<T> | Reactive<T>
): reactive is SomeReactive<T> & { tag: Tag } {
  const { tag, lastRevision } = reactive as Reactive<T>;

  // not yet computed
  if (tag === null) return false;

  return validateTag(tag, lastRevision);
}
export function hasError(reactive: SomeReactive): boolean {
  return !!(reactive as Reactive).error;
}
