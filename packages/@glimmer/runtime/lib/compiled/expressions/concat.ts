import type { Dict, Maybe } from '@glimmer/interfaces';
import { FallibleFormula, readReactive, type SomeReactive } from '@glimmer/reference';
import { enumerate } from '@glimmer/util';

export function createConcatRef(partsRefs: SomeReactive[]) {
  return FallibleFormula(() => {
    let parts = new Array<string>();

    for (const [i, ref] of enumerate(partsRefs)) {
      let result = readReactive(ref);

      if (result.type === 'err') {
        // @fixme a version of FallibleFormula that you can directly return results to
        throw result.value;
      }

      const value = result.value as Maybe<Dict>;
      if (value !== null && value !== undefined) {
        parts[i] = castToString(value);
      }
    }

    return parts.length > 0 ? parts.join('') : null;
  });
}

function castToString(value: Dict) {
  if (typeof value.toString !== 'function') {
    return '';
  }

  return String(value);
}
