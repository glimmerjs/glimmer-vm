import type { Reactive, ReactiveFormula } from '@glimmer/interfaces';

import type { InternalReactive } from './internal/reactive';

import { ResultAccessor } from './accessor';
import { unwrapReactive } from './core';
import { Formula } from './formula';
import { readInternalReactive, updateInternalReactive } from './internal/operations';
import { DEEPLY_CONSTANT, READONLY_CELL, REFERENCE } from './internal/reactive';

export function toReadonly<T>(reactive: Reactive<T>): ReactiveFormula<T> {
  return Formula(() => unwrapReactive(reactive));
}

export function toMut<T>(maybeMut: Reactive<T>): Reactive<T> {
  const reactive = maybeMut as InternalReactive;

  return ResultAccessor({
    get: () => readInternalReactive(maybeMut as InternalReactive<T>),
    set: (value: unknown) => updateInternalReactive(reactive, value),
  });
}
export function isConstant(reactive: Reactive) {
  switch (reactive[REFERENCE]) {
    case READONLY_CELL:
    case DEEPLY_CONSTANT:
      return true;
    default:
      return false;
  }
}
