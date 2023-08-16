import type { Reactive } from '@glimmer/interfaces';

import type { InternalReactive } from './internal/reactive';

export function clearError(reactive: Reactive) {
  const internal = reactive as InternalReactive;

  internal.error = null;

  // clearing the tag will cause the reference to be invalidated.
  internal.tag = null;

  internal.lastValue = null;
}
