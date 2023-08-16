import type { Dict, Maybe } from '@glimmer/interfaces';
import type {Reactive} from '@glimmer/reference';
import { readReactive, ResultFormula  } from '@glimmer/reference';
import { enumerate, Ok, stringifyDebugLabel } from '@glimmer/util';

export function createConcatRef(partsRefs: Reactive[]) {
  return ResultFormula(
    () => {
      let parts = new Array<string>();

      for (const [i, ref] of enumerate(partsRefs)) {
        let result = readReactive(ref);

        if (result.type === 'err') {
          return result;
        }

        const value = result.value as Maybe<Dict>;
        if (value !== null && value !== undefined) {
          parts[i] = castToString(value);
        }
      }

      return Ok(parts.length > 0 ? parts.join('') : null);
    },
    import.meta.env.DEV ? concatLabel(partsRefs) : undefined
  );
}

function concatLabel(parts: Reactive[]) {
  const body = parts.map((reactive) => `{${stringifyDebugLabel(reactive)}}`).join(' + ');
  return `(concat ${body})`;
}

function castToString(value: Dict) {
  if (typeof value.toString !== 'function') {
    return '';
  }

  return String(value);
}
