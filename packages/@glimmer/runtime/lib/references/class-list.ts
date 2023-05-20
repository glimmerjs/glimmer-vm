import { createComputeRef, type Reference, valueForRef } from '@glimmer/reference';

import { normalizeStringValue } from '../dom/normalize';

export default function createClassListReference(list: Reference[]) {
  return createComputeRef(() => {
    let returnValue: string[] = [];

    for (let reference of list) {
      let value = normalizeStringValue(typeof reference === 'string' ? reference : valueForRef(reference));
      if (value) returnValue.push(value);
    }

    return returnValue.length === 0 ? null : returnValue.join(' ');
  });
}
