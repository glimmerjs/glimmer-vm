import { Reference, Tag, combineTagged, VersionedReference } from '@glimmer/reference';
import { Option } from '@glimmer/util';

import { normalizeStringValue } from '../dom/normalize';
import { UserValue } from '@glimmer/interfaces';

export default class ClassListReference
  implements Reference<Option<string>>, VersionedReference<UserValue> {
  public tag: Tag;

  constructor(private list: Array<Reference<UserValue>>) {
    this.tag = combineTagged(list);
    this.list = list;
  }

  value(): Option<string> & UserValue {
    let ret: string[] = [];
    let { list } = this;

    for (let i = 0; i < list.length; i++) {
      let value = normalizeStringValue(list[i].value());
      if (value) ret.push(value);
    }

    return (ret.length === 0 ? null : ret.join(' ')) as Option<string> & UserValue;
  }
}
