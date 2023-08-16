import type {
  ConstantReactiveError,
  ReactiveFormula,
  Reactive,
  ReactiveAccessor,
} from '@glimmer/interfaces';

import type { InternalReactive } from './internal/reactive';

import { ACCESSOR, CONSTANT_ERROR, FALLIBLE_FORMULA, REFERENCE } from './internal/reactive';

export function isFallibleFormula<T>(_ref: Reactive<T>): _ref is ReactiveFormula<T> {
  return _ref[REFERENCE] === FALLIBLE_FORMULA;
}

export function isAccessor<T>(_ref: Reactive<T>): _ref is ReactiveAccessor<T> {
  return _ref[REFERENCE] === ACCESSOR;
}

export function isConstantError<T>(_ref: Reactive<T>): _ref is ConstantReactiveError {
  return _ref[REFERENCE] === CONSTANT_ERROR;
}
export function isUpdatableRef(_ref: Reactive) {
  const ref = _ref as InternalReactive;

  return ref.update !== null;
}
