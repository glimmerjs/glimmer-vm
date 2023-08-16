import type { InternalReactive, Reactive } from './internal/reactive';

import { internalHasError } from './internal/errors';
import { validateInternalReactive } from './internal/operations';

export { REFERENCE as INTERNAL_REFERENCE } from './internal/reactive';

/**
 * @internal
 */
export function validateReactive(reactive: Reactive): boolean {
  return validateInternalReactive(reactive as InternalReactive);
}

/**
 * @internal
 */
export function hasError(reactive: Reactive): boolean {
  return internalHasError(reactive as InternalReactive);
}
