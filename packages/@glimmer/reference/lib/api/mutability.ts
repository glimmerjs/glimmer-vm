import type { Reactive } from '@glimmer/interfaces';

import type { InternalReactive } from './internal/reactive';

import { InternalResultAccessor } from './accessor';
import { unwrapReactive } from './core';
import { Formula } from './formula';
import { readInternalReactive, updateInternalReactive } from './internal/operations';
import { DEEPLY_CONSTANT, MUTABLE_REF, READONLY_CELL, REFERENCE } from './internal/reactive';
import { isMutRef, isUpdatableRef } from './predicates';

export function toReadonly<T>(reactive: Reactive<T>): Reactive<T> {
  if (isMutRef(reactive) || isUpdatableRef(reactive)) {
    return Formula(() => unwrapReactive(reactive));
  } else {
    return reactive;
  }
}

export function toMut<T>(maybeMut: Reactive<T>): Reactive<T> {
  const reactive = maybeMut as InternalReactive;

  if (isMutRef(maybeMut)) {
    return maybeMut;
  }

  // TODO probably should assert that maybeMut is updatable
  // Ember already has the same assertion

  return InternalResultAccessor({
    get: () => readInternalReactive(maybeMut as InternalReactive<T>),
    set: (value: unknown) => updateInternalReactive(reactive, value),
  }, undefined, MUTABLE_REF);
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
