import type {
  DescriptionSpec,
  FallibleReactiveFormula,
  InfallibleReactiveFormula,
  ReactiveResult,
} from '@glimmer/interfaces';
import type { RETURN_TYPE } from '../reference';

import { devmode, setDescription, toDescription } from '@glimmer/util';

import {
  FALLIBLE_FORMULA,
  INFALLIBLE_FORMULA,
  Reactive,
  setFromFallibleCompute,
  setResult,
} from '../reference';

const FALLIBLE_FORMULA_DEFAULTS = devmode(() => ({
  readonly: false,
  fallible: false,
  kind: 'cell',
  label: ['(FallibleFormula)'],
}));

/**
 * A fallible formula invokes user code. If the user code throws an exception, the formula returns
 * an error {@linkcode Result}. Otherwise, it returns an ok {@linkcode Result}.
 */
export function FallibleFormula<T = unknown>(
  compute: () => T,
  debugLabel?: DescriptionSpec
): FallibleReactiveFormula<T> {
  const ref = new Reactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => setFromFallibleCompute(ref, compute);

  setDescription(
    ref,
    devmode(() => toDescription(debugLabel, FALLIBLE_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}
const RESULT_FORMULA_DEFAULTS = devmode(() => ({
  readonly: true,
  fallible: true,
  kind: 'formula',
  label: [`(ResultFormula)`],
}));
/**
 * The `compute` function must be infallible and convert any errors to results.
 */
export function ResultFormula<T = unknown>(
  compute: () => ReactiveResult<T>,
  description?: DescriptionSpec
) {
  const ref = new Reactive<T>(FALLIBLE_FORMULA);

  ref.compute = () => setResult(ref, compute());

  setDescription(
    ref,
    devmode(() => toDescription(description, RESULT_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}
const INFALLIBLE_FORMULA_DEFAULTS = devmode(() => ({
  readonly: true,
  fallible: false,
  kind: 'formula',
  label: [`(InfallibleFormula)`],
}));
/**
 * An infallible formula does not invoke user code. If an infallible formula's compute function
 * throws an error, it's a bug and there is no error recovery.
 */
export function InfallibleFormula<T = unknown>(
  compute: () => T,
  description?: DescriptionSpec
): InfallibleReactiveFormula<T> {
  const ref = new Reactive<T>(INFALLIBLE_FORMULA);

  ref.compute = compute;

  setDescription(
    ref,
    devmode(() => toDescription(description, INFALLIBLE_FORMULA_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}
