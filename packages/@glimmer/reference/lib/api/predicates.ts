import type {
  ConstantReactiveError,
  Reactive,
  ReactiveAccessor,
  ReactiveFormula,
  ReactiveMutableReference,
} from '@glimmer/interfaces';

import type { InternalReactive } from './internal/reactive';

import { ACCESSOR, CONSTANT_ERROR, FALLIBLE_FORMULA, MUTABLE_REF, REFERENCE } from './internal/reactive';

export function isFallibleFormula<T>(_ref: Reactive<T>): _ref is ReactiveFormula<T> {
  return _ref[REFERENCE] === FALLIBLE_FORMULA;
}

export function isAccessor<T>(_ref: Reactive<T>): _ref is ReactiveAccessor<T> {
  return _ref[REFERENCE] === ACCESSOR;
}

export function isMutRef<T>(_ref: Reactive<T>): _ref is ReactiveMutableReference<T> {
  return _ref[REFERENCE] === MUTABLE_REF;
}

export function isConstantError<T>(_ref: Reactive<T>): _ref is ConstantReactiveError {
  return _ref[REFERENCE] === CONSTANT_ERROR;
}

export function isUpdatableRef(_ref: Reactive) {
  const ref = _ref as InternalReactive;

  return (isAccessor(_ref) || isMutRef(_ref)) && ref.update !== null;
}
