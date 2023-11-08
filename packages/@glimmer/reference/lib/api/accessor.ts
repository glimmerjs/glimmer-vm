import type { DescriptionSpec, ReactiveResult, SomeReactive } from '@glimmer/interfaces';
import type { RETURN_TYPE } from '../reference';

import {
  devmode,
  devmodeOr,
  setDescription,
  stringifyDebugLabel,
  toDescription,
  UserException,
} from '@glimmer/util';

import { ACCESSOR, Reactive, setError, setFromFallibleCompute, setResult } from '../reference';

const RESULT_ACCESSOR_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: true,
  kind: 'formula',
  label: [`(ResultAccessor)`],
}));

export function ResultAccessor<T = unknown>(
  options: {
    get: () => ReactiveResult<T>;
    set: (val: T) => ReactiveResult<void>;
  },
  description?: DescriptionSpec
): SomeReactive<T> {
  const { get, set } = options;

  const ref = new Reactive<T>(ACCESSOR);

  ref.compute = () => setResult(ref, get());

  ref.update = (value: T) => {
    const setResult = set(value);

    if (setResult.type === 'ok') {
      ref.lastValue = value;
    } else {
      setError(ref, setResult.value);
    }
  };

  setDescription(
    ref,
    devmode(() => toDescription(description, RESULT_ACCESSOR_DEFAULTS))
  );
  return ref as RETURN_TYPE;
}
const ACCESSOR_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: true,
  kind: 'formula',
  label: [`(Accessor)`],
}));

export function Accessor<T = unknown>(
  options: { get: () => T; set: (val: T) => void },
  description?: DescriptionSpec
): SomeReactive<T> {
  const { get, set } = options;

  const ref = new Reactive<T>(ACCESSOR);

  ref.compute = () => setFromFallibleCompute(ref, get);

  ref.update = (value: T) => {
    try {
      set(value);
      return value;
    } catch (e) {
      setError(
        ref,
        UserException.from(
          e,
          `An error occured setting ${devmodeOr(() => stringifyDebugLabel(ref), `an accessor`)}`
        )
      );
    }
  };

  setDescription(
    ref,
    devmode(() => toDescription(description, ACCESSOR_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}
