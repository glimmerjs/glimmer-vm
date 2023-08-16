import type { Reactive, ReactiveResult } from '@glimmer/interfaces';
import { unwrapResult } from '@glimmer/util';

import type { InternalReactive } from './internal/reactive';

import { readInternalReactive, updateInternalReactive } from './internal/operations';

/**
 * This is generally not what you want, as it rethrows errors. It's useful in testing and console
 * situations, and as a transitional mechanism away from valueForRef.
 */
export function unwrapReactive<T>(reactive: Reactive<T>): T {
  return unwrapResult(readInternalReactive(reactive as InternalReactive<T>));
}

export function updateReactive<T>(reactive: Reactive<T>, value: T) {
  updateInternalReactive(reactive as InternalReactive<T>, value);
}

export function readReactive<T>(reactive: Reactive<T>): ReactiveResult<T> {
  return readInternalReactive(reactive as InternalReactive<T>);
}
