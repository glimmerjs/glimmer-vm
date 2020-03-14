import { Reference } from '@glimmer/reference';
import { memoizeTracked } from '@glimmer/validator';
import { Option } from '@glimmer/util';

import { normalizeStringValue } from '../dom/normalize';

export default class ClassListReference implements Reference<Option<string>> {
  constructor(private list: Reference<unknown>[]) {
    this.list = list;
  }

  value = memoizeTracked(
    (): Option<string> => {
      let ret: string[] = [];
      let { list } = this;

      for (let i = 0; i < list.length; i++) {
        let value = normalizeStringValue(list[i].value());
        if (value) ret.push(value);
      }

      return ret.length === 0 ? null : ret.join(' ');
    }
  );
}
