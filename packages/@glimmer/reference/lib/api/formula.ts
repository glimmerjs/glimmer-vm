import type {
  DefaultDescriptionFields,
  DescriptionSpec,
  ReactiveComputedCell,
  ReactiveFormula,
  ReactiveResult,
  RETURN_TYPE,
} from '@glimmer/interfaces';
import { devmode, setDescription, toValidatableDescription } from '@glimmer/util';

import { setFromFallibleCompute, setLastValue, setResult } from './internal/errors';
import { COMPUTED_CELL, FALLIBLE_FORMULA, InternalReactive } from './internal/reactive';

const FALLIBLE_FORMULA_DEFAULTS = devmode(
  () =>
    ({
      type: 'FallibleFormula',
      read: 'fallible',
      write: 'none',
      label: ['(FallibleFormula)'],
    }) satisfies DefaultDescriptionFields
);

/**
 * A fallible formula invokes user code. If the user code throws an exception, the formula returns
 * an error {@linkcode Result}. Otherwise, it returns an ok {@linkcode Result}.
 */
export function Formula<T>(compute: () => T, debugLabel?: DescriptionSpec): ReactiveFormula<T> {
  const ref = new InternalReactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => setFromFallibleCompute(ref, compute);

  setDescription(
    ref,
    devmode(() => toValidatableDescription(debugLabel, FALLIBLE_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

const RESULT_FORMULA_DEFAULTS = devmode(
  () =>
    ({
      type: 'ResultFormula',
      read: 'fallible',
      write: 'none',
      label: [`{result formula}`],
    }) satisfies DefaultDescriptionFields
);

/**
 * The `compute` function must be infallible and convert any errors to results.
 */
export function ResultFormula<T = unknown>(
  compute: () => ReactiveResult<T>,
  description?: DescriptionSpec
) {
  const ref = new InternalReactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => setResult(ref, compute());

  setDescription(
    ref,
    devmode(() => toValidatableDescription(description, RESULT_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

const COMPUTED_CELL_DEFAULTS = devmode(
  () =>
    ({
      type: 'InfallibleFormula',
      read: 'infallible',
      write: 'none',
      label: [`{computed cell}`],
    }) satisfies DefaultDescriptionFields
);

/**
 * A computed cell does not invoke user code. If a computed cell's compute function throws an error,
 * it's a bug and there is no error recovery.
 */
export function ComputedCell<T = unknown>(
  compute: () => T,
  description?: DescriptionSpec
): ReactiveComputedCell<T> {
  const ref = new InternalReactive<T>(COMPUTED_CELL);

  ref.compute = () => setLastValue(ref, compute());

  setDescription(
    ref,
    devmode(() => toValidatableDescription(description, COMPUTED_CELL_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}
