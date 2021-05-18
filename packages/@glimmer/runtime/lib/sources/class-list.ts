import { Source } from '@glimmer/interfaces';
import { createCache, getValue } from '@glimmer/validator';

import { normalizeStringValue } from '../dom/normalize';

export default function createClassListSource(list: Source[]): Source<string | null> {
  return createCache(() => {
    let ret: string[] = [];

    for (let i = 0; i < list.length; i++) {
      let ref = list[i];
      let value = normalizeStringValue(typeof ref === 'string' ? ref : getValue(list[i]));
      if (value) ret.push(value);
    }

    return ret.length === 0 ? null : ret.join(' ');
  });
}
