import type {
  ConstantReactiveError,
  ReactiveResult,
  RETURN_TYPE,
  UserException as UserExceptionInterface,
} from '@glimmer/interfaces';
import {
  devmode,
  devmodeOr,
  setDescription,
  stringifyDebugLabel,
  UserException,
} from '@glimmer/util';
import { CONSTANT_TAG } from '@glimmer/validator';

import { updateInternalReactive } from './operations';
import { CONSTANT_ERROR, InternalReactive } from './reactive';

export function setLastValue<T>(reactive: InternalReactive<T>, value: T): T {
  reactive.lastValue = value;
  reactive.error = null;
  return value;
}

export function setError<T>(reactive: InternalReactive<T>, error: UserExceptionInterface) {
  reactive.lastValue = null;
  reactive.error = error;

  // since the setter threw, we want the reference to be invalid so that its consumers will see the
  // invalidation and handle the error.
  reactive.tag = null;
}

export function setResult<T>(internal: InternalReactive<T>, result: ReactiveResult<T>) {
  switch (result.type) {
    case 'ok':
      return setLastValue(internal, result.value);
    case 'err':
      setError(internal, result.value);
  }
}
export function setFromFallibleCompute<T>(
  internal: InternalReactive<T>,
  compute: () => T
): T | undefined {
  try {
    return setLastValue(internal, compute());
  } catch (e) {
    setError(
      internal,
      UserException.from(
        e,
        `An error occured while computing ${devmodeOr(
          () => stringifyDebugLabel(internal),
          'a formula'
        )}`
      )
    );
  }
}
export function updateRefWithResult<T>(internal: InternalReactive<T>, value: ReactiveResult<T>) {
  switch (value.type) {
    case 'err':
      setError(internal as InternalReactive, value.value);
      break;
    case 'ok':
      updateInternalReactive(internal, value.value);
      break;
  }
}

export function internalHasError(reactive: InternalReactive): boolean {
  return !!reactive.error;
}

export function Poison(
  error: UserExceptionInterface,
  debugLabel?: false | string
): ConstantReactiveError {
  const ref = new InternalReactive(CONSTANT_ERROR);

  ref.tag = CONSTANT_TAG;
  ref.error = error;

  setDescription(
    ref,
    devmode(() => ({
      readonly: true,
      fallible: true,
      label: [debugLabel || `(Poison)`],
      kind: 'poisoned',
    }))
  );

  return ref as RETURN_TYPE;
}
