import { createComputeRef, type Reference, valueForRef } from '@glimmer/reference';
import { normalizeStringValue } from '../../dom/normalize';

export function createConcatRef(partsReferences: Reference[]) {
  return createComputeRef(() => {
    let parts = partsReferences
      .map(valueForRef)
      .filter((value) => value != null)
      .map(normalizeStringValue);

    return parts.length > 0 ? parts.join('') : null;
  });
}
