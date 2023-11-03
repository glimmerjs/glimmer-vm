import { FallibleFormula, type SomeReactive, unwrapReactive } from '@glimmer/reference';

import { normalizeStringValue } from '../dom/normalize';

export default function createClassListRef(list: SomeReactive[]) {
  return FallibleFormula(() => {
    let ret: string[] = [];

    for (const ref of list) {
      let value = normalizeStringValue(typeof ref === 'string' ? ref : unwrapReactive(ref));
      if (value) ret.push(value);
    }

    return ret.length === 0 ? null : ret.join(' ');
  });
}
