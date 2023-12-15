import type {
  AccessorType,
  DefaultDescriptionFields,
  DescriptionSpec,
  MutableReferenceType,
  Reactive,
  ReactiveResult,
} from '@glimmer/interfaces';
import {
  devmode,
  devmodeOr,
  setDescription,
  stringifyDebugLabel,
  toValidatableDescription,
  UserException,
} from '@glimmer/util';

import { setError, setFromFallibleCompute, setResult } from './internal/errors';
import { ACCESSOR, InternalReactive } from './internal/reactive';

const RESULT_ACCESSOR_DEFAULTS = devmode(
  () =>
    ({
      type: 'ResultAccessor',
      read: 'fallible',
      write: 'fallible',
      label: [`(ResultAccessor)`],
    }) satisfies DefaultDescriptionFields
);

export function ResultAccessor<T = unknown>(
  options: {
    get: () => ReactiveResult<T>;
    set: (val: T) => ReactiveResult<void>;
  },
  description?: DescriptionSpec
): Reactive<T> {
  return InternalResultAccessor(options, description);
}

export function InternalResultAccessor<T = unknown>(
  options: {
    get: () => ReactiveResult<T>;
    set: (val: T) => ReactiveResult<void>;
  },
  description?: DescriptionSpec,
  type: AccessorType | MutableReferenceType = ACCESSOR
): Reactive<T> {
  const { get, set } = options;

  const internal = new InternalReactive<T>(type);

  internal.compute = () => setResult(internal, get());

  internal.update = (value: T) => {
    const setResult = set(value);

    if (setResult.type === 'ok') {
      internal.lastValue = value;
    } else {
      setError(internal, setResult.value);
    }
  };

  setDescription(
    internal,
    devmode(() => toValidatableDescription(description, RESULT_ACCESSOR_DEFAULTS))
  );

  return internal as Reactive<T>;
}

const ACCESSOR_DEFAULTS = devmode(
  () =>
    ({
      type: 'Accessor',
      read: 'fallible',
      write: 'fallible',
      label: [`(Accessor)`],
    }) satisfies DefaultDescriptionFields
);

export function Accessor<T = unknown>(
  options: { get: () => T; set: (val: T) => void },
  description?: DescriptionSpec
): Reactive<T> {
  const { get, set } = options;

  const internal = new InternalReactive<T>(ACCESSOR);

  internal.compute = () => setFromFallibleCompute(internal, get);

  internal.update = (value: T) => {
    try {
      set(value);
      return value;
    } catch (e) {
      setError(
        internal,
        UserException.from(
          e,
          `An error occured setting ${devmodeOr(
            () => stringifyDebugLabel(internal),
            `an accessor`
          )}`
        )
      );
    }
  };

  setDescription(
    internal,
    devmode(() => toValidatableDescription(description, ACCESSOR_DEFAULTS))
  );

  return internal as Reactive<T>;
}
